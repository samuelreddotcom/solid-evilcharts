/**
 * Command v2 — searchable palette (think ⌘K).
 *
 * v2 keeps v1's engine wholesale (it's faster and better-behaved than the
 * cmdk-solid port) and layers on the genuinely-useful features that port had:
 *
 *   • IME-safe Enter        — no accidental select mid-composition (CJK input)
 *   • Full keyboard nav     — Home/End, loop, vim (ctrl+n/j/p/k),
 *                             meta+↑/↓ first/last, alt+↑/↓ jump groups
 *   • shouldFilter={false}  — opt out of built-in filtering for async/server
 *                             results you render yourself
 *   • Controlled highlight  — `value` + `onValueChange` on <Command>
 *   • forceMount            — keep an item/group rendered regardless of filter
 *   • disablePointerSelection — don't move the highlight on hover
 *   • --cmdk-list-height    — CSS var on <CommandList> for height animation
 *
 * Everything below the "engine" line is unchanged from v1 in spirit; read v1's
 * header for the deep rationale on the registry / DOM-order / CSS-hidden
 * decisions. The short version:
 *
 * Architecture: items self-register with a shared registry on mount, by
 * value. The parent `Command` keeps the ordered list of registered values
 * and derives `visibleValues` (filtered by score against the current query).
 *
 *   <Command>
 *     <CommandInput />
 *     <CommandList>
 *       <CommandGroup heading="...">
 *         <CommandItem value="..." label="..." onSelect={...}>...</CommandItem>
 *       </CommandGroup>
 *     </CommandList>
 *   </Command>
 *
 * ─── Filtering: fuzzy score, not substring ──────────────────────────────────
 *
 * The default filter is a port of cmdk's `command-score` algorithm: it
 * returns a number in [0, 1]. Items with score > 0 are visible. `CommandItem`
 * accepts an optional `keywords` array to match on synonyms. Override with
 * `filter` on <Command>, or turn filtering off entirely with
 * `shouldFilter={false}` (then you render/prune items yourself).
 *
 * We do NOT reorder items by score — they stay in DOM order. (Note: the
 * cmdk-solid port's score-sort is disabled there too — sorting <For>-generated
 * nodes desyncs Solid's renderer. Stable order is the right call regardless.)
 *
 * ─── IMPORTANT: visibility uses CSS `hidden`, NOT `<Show>` ───────────────────
 *
 * CommandItem/CommandGroup hide themselves with the `hidden` class when
 * filtered out. They stay in the DOM. Wrapping them in `<Show when={visible}>`
 * would unmount them → fire onCleanup → wipe their registration → the palette
 * would go dead after a search+clear. See v1's header for the full trap. Use
 * CSS visibility instead; `<Show>` stays correct for CommandEmpty/Separator,
 * which own no registration.
 */
import { Dialog as DialogPrimitive } from "@ark-ui/solid/dialog";
import { SearchIcon } from "lucide-solid";
import {
  type ComponentProps,
  type JSX,
  Show,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  on,
  onCleanup,
  onMount,
  splitProps,
  untrack,
  useContext,
} from "solid-js";
import { Portal } from "solid-js/web";

import { cn } from "@/lib/utils";

import { commandScore } from "./command-score";

// ─── Command Context ──────────────────────────────────────────────────────────

type CommandItemData = {
  value: string;
  label: string;
  onSelect?: () => void;
  onHighlight?: () => void;
  disabled?: boolean;
  groupId?: string;
  keywords?: string[];
};

type CommandContextValue = {
  register: (item: CommandItemData, element: HTMLElement) => void;
  unregister: (value: string) => void;
  query: () => string;
  setQuery: (q: string) => void;
  isVisible: (value: string) => boolean;
  isEmpty: () => boolean;
  hasVisibleItemsInGroup: (groupId: string) => boolean;
  highlightedValue: () => string | null;
  setHighlighted: (value: string | null) => void;
  ready: () => boolean;
  loading: () => boolean;
  shouldFilter: () => boolean;
  disablePointerSelection: () => boolean;
};

const CommandCtx = createContext<CommandContextValue | undefined>();

function useCommandCtx() {
  const ctx = useContext(CommandCtx);
  if (!ctx) throw new Error("Command components must be used inside <Command>");
  return ctx;
}

// ─── Group Context ────────────────────────────────────────────────────────────

const CommandGroupCtx = createContext<{ groupId: string } | undefined>();

// ─── Command ──────────────────────────────────────────────────────────────────

interface CommandProps {
  class?: string;
  children?: JSX.Element;
  filter?: (label: string, query: string, keywords?: string[]) => number;
  /**
   * When true, `CommandEmpty` is suppressed even if no items match the query.
   * Use this while an async source is in flight — it avoids the "No results"
   * flash between keystroke and result arrival.
   */
  loading?: boolean;
  /**
   * Set to `false` to turn off built-in filtering. Every registered item stays
   * visible and you're responsible for rendering only the items you want (e.g.
   * server-side search). Pairs well with `loading`.
   */
  shouldFilter?: boolean;
  /** Loop the highlight around the ends when arrowing. Default: false. */
  loop?: boolean;
  /** Enable ctrl+n/ctrl+j (down) and ctrl+p/ctrl+k (up). Default: true. */
  vimBindings?: boolean;
  /** Don't move the highlight on pointer hover. Default: false. */
  disablePointerSelection?: boolean;
  /** Controlled highlighted item value. */
  value?: string;
  /** Fired whenever the highlighted item value changes. */
  onValueChange?: (value: string) => void;
}

function Command(props: CommandProps) {
  // Registry stores the item data + its DOM element. The element is what lets
  // us order items by DOM position rather than mount order.
  const registry = new Map<
    string,
    CommandItemData & { element: HTMLElement }
  >();
  const [orderedValues, setOrderedValues] = createSignal<string[]>([]);

  // Re-sort registered values by DOM document position. compareDocumentPosition
  // is a native browser API — fast, and authoritative about visual order.
  const recomputeOrder = () => {
    const values = Array.from(registry.keys());
    values.sort((a, b) => {
      const elA = registry.get(a)?.element;
      const elB = registry.get(b)?.element;
      if (!elA || !elB) return 0;
      const pos = elA.compareDocumentPosition(elB);
      if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
      return 0;
    });
    setOrderedValues(values);
  };

  // Batched recompute — N items mounting in one tick get one sort, not N.
  let recomputeScheduled = false;
  const scheduleRecompute = () => {
    if (recomputeScheduled) return;
    recomputeScheduled = true;
    queueMicrotask(() => {
      recomputeScheduled = false;
      recomputeOrder();
    });
  };
  const [query, setQuery] = createSignal("");
  // Initial value (if controlled) is applied by the sync effect below, which
  // runs on mount before paint — so start null and let it populate.
  const [highlighted, setHighlighted] = createSignal<string | null>(null);

  const shouldFilter = () => props.shouldFilter !== false;
  const loop = () => props.loop ?? false;
  const vimBindings = () => props.vimBindings !== false;

  // Controlled highlight: mirror props.value into the internal signal. Tracks
  // ONLY props.value — also tracking highlighted() would fight the validity
  // effect below and loop forever.
  createEffect(
    on(
      () => props.value,
      (value) => {
        if (value !== undefined && value !== untrack(highlighted)) {
          setHighlighted(value);
        }
      },
    ),
  );

  // Notify on highlight change (fires for keyboard, hover, and auto-highlight).
  let lastNotified: string | null | undefined;
  createEffect(() => {
    const h = highlighted();
    if (h !== lastNotified) {
      lastNotified = h;
      props.onValueChange?.(h ?? "");
    }
  });

  // `ready` gates CommandEmpty / CommandGroup hiding until the initial
  // registration pass has SETTLED — prevents a "No results" flash on a static
  // list. rAF runs after microtasks + layout, so by the time it flips the
  // registry and ordering are fully synced. (See v1 header for the history.)
  const [ready, setReady] = createSignal(false);
  onMount(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    onCleanup(() => cancelAnimationFrame(raf));
  });

  const filterFn =
    props.filter ??
    ((label: string, q: string, keywords?: string[]) =>
      commandScore(label, q, keywords));

  // Visibility = matches the query (or no query, or filtering is off). Disabled
  // is a SEPARATE dimension — disabled items still render, greyed and skipped
  // by keyboard nav. `orderedValues` is DOM order, so `visibleValues` reflects
  // visual order — what keyboard nav needs to feel linear.
  const visibleValues = createMemo(() => {
    const q = query();
    const ordered = orderedValues();
    if (!q || !shouldFilter()) return ordered;
    return ordered.filter((v) => {
      const item = registry.get(v);
      if (!item) return false;
      return filterFn(item.label, q, item.keywords) > 0;
    });
  });

  // Derived lookups — memoized so per-item reactivity is O(1) per read.
  const visibleSet = createMemo(() => new Set(visibleValues()));
  const visibleGroupSet = createMemo(() => {
    const groups = new Set<string>();
    for (const v of visibleValues()) {
      const gid = registry.get(v)?.groupId;
      if (gid) groups.add(gid);
    }
    return groups;
  });
  const navigableValues = createMemo(() =>
    visibleValues().filter((v) => !registry.get(v)?.disabled),
  );

  // Ordered list of group ids that currently contain at least one navigable
  // item — drives alt+↑/↓ group jumping. DOM order, same as navigableValues.
  const navigableGroupOrder = () => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const v of navigableValues()) {
      const gid = registry.get(v)?.groupId;
      if (gid && !seen.has(gid)) {
        seen.add(gid);
        order.push(gid);
      }
    }
    return order;
  };

  // Keep highlight valid as filtered results change.
  createEffect(() => {
    const nav = navigableValues();
    const curr = highlighted();
    // Before the first registration pass settles the list is empty — don't
    // clobber an initial controlled value that just hasn't registered yet.
    if (!ready() && nav.length === 0) return;
    if (curr !== null && !nav.includes(curr)) {
      setHighlighted(nav[0] ?? null);
    } else if (curr === null && nav.length > 0 && query()) {
      setHighlighted(nav[0] ?? null);
    }
  });

  // Single effect drives scroll-into-view + onHighlight callback.
  createEffect(() => {
    const h = highlighted();
    if (!h) return;
    const item = registry.get(h);
    if (!item) return;
    item.element.scrollIntoView({ block: "nearest" });
    item.onHighlight?.();
  });

  const ctx: CommandContextValue = {
    register: (item, element) => {
      registry.set(item.value, { ...item, element });
      scheduleRecompute();
    },
    unregister: (value) => {
      registry.delete(value);
      scheduleRecompute();
    },
    query,
    setQuery,
    isVisible: (value) => {
      // No query / filtering off → everything visible (disabled renders greyed).
      if (!query() || !shouldFilter()) return true;
      return visibleSet().has(value);
    },
    isEmpty: () => visibleValues().length === 0,
    hasVisibleItemsInGroup: (groupId) => visibleGroupSet().has(groupId),
    highlightedValue: highlighted,
    setHighlighted,
    ready,
    loading: () => props.loading ?? false,
    shouldFilter,
    disablePointerSelection: () => props.disablePointerSelection ?? false,
  };

  // ── Keyboard navigation ─────────────────────────────────────────────────

  const moveByItem = (change: 1 | -1) => {
    const nav = navigableValues();
    if (nav.length === 0) return;
    const idx = nav.indexOf(highlighted() ?? "");
    if (idx === -1) {
      // Nothing (valid) highlighted yet — enter from the appropriate end.
      setHighlighted(
        change > 0 ? (nav[0] ?? null) : (nav[nav.length - 1] ?? null),
      );
      return;
    }
    let next = idx + change;
    if (loop()) {
      if (next < 0) next = nav.length - 1;
      else if (next >= nav.length) next = 0;
    } else {
      next = Math.max(0, Math.min(next, nav.length - 1));
    }
    setHighlighted(nav[next] ?? null);
  };

  const moveToEdge = (edge: "first" | "last") => {
    const nav = navigableValues();
    if (nav.length === 0) return;
    setHighlighted((edge === "first" ? nav[0] : nav[nav.length - 1]) ?? null);
  };

  const moveByGroup = (change: 1 | -1) => {
    const order = navigableGroupOrder();
    // No groups (or ungrouped highlight) → fall back to item-wise movement.
    if (order.length === 0) {
      moveByItem(change);
      return;
    }
    const nav = navigableValues();
    const curGid = highlighted()
      ? registry.get(highlighted()!)?.groupId
      : undefined;

    let targetGid: string | undefined;
    if (!curGid || !order.includes(curGid)) {
      targetGid = change > 0 ? order[0] : order[order.length - 1];
    } else {
      const gi = order.indexOf(curGid);
      let ni = gi + change;
      if (loop()) {
        if (ni < 0) ni = order.length - 1;
        else if (ni >= order.length) ni = 0;
      } else {
        ni = Math.max(0, Math.min(ni, order.length - 1));
      }
      targetGid = order[ni];
    }

    const target = nav.find((v) => registry.get(v)?.groupId === targetGid);
    if (target) setHighlighted(target);
    else moveByItem(change);
  };

  const next = (e: KeyboardEvent) => {
    e.preventDefault();
    if (e.metaKey) moveToEdge("last");
    else if (e.altKey) moveByGroup(1);
    else moveByItem(1);
  };

  const prev = (e: KeyboardEvent) => {
    e.preventDefault();
    if (e.metaKey) moveToEdge("first");
    else if (e.altKey) moveByGroup(-1);
    else moveByItem(-1);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "n":
      case "j":
        if (vimBindings() && e.ctrlKey) next(e);
        break;
      case "ArrowDown":
        next(e);
        break;
      case "p":
      case "k":
        if (vimBindings() && e.ctrlKey) prev(e);
        break;
      case "ArrowUp":
        prev(e);
        break;
      case "Home":
        e.preventDefault();
        moveToEdge("first");
        break;
      case "End":
        e.preventDefault();
        moveToEdge("last");
        break;
      case "Enter": {
        // IME-safe: don't select while composing (CJK input). keyCode 229 is
        // the Japanese IME + Safari case where isComposing is unreliable.
        if (e.isComposing || e.keyCode === 229) break;
        e.preventDefault();
        const value = highlighted();
        const item = value ? registry.get(value) : undefined;
        // Defense in depth — highlight skips disabled, but never fire on one.
        if (item && !item.disabled) item.onSelect?.();
        break;
      }
    }
  };

  return (
    <CommandCtx.Provider value={ctx}>
      <div
        data-slot="command"
        class={cn(
          "flex flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground",
          props.class,
        )}
        onKeyDown={handleKeyDown}
      >
        {props.children}
      </div>
    </CommandCtx.Provider>
  );
}

// ─── CommandInput ─────────────────────────────────────────────────────────────

function CommandInput(props: ComponentProps<"input">) {
  const [local, rest] = splitProps(props, ["class", "onInput"]);
  const ctx = useCommandCtx();

  return (
    <div
      data-slot="command-input-wrapper"
      class="flex items-center gap-2 border-b border-border px-3"
    >
      <SearchIcon class="size-4 shrink-0 opacity-50" />
      <input
        data-slot="command-input"
        type="text"
        role="combobox"
        aria-expanded="true"
        autocomplete="off"
        autocorrect="off"
        spellcheck={false}
        class={cn(
          "flex h-10 w-full bg-transparent py-2 text-sm outline-none",
          "placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          local.class,
        )}
        onInput={(e) => {
          ctx.setQuery(e.currentTarget.value);
          if (typeof local.onInput === "function") local.onInput(e);
        }}
        {...rest}
      />
    </div>
  );
}

// ─── CommandList ──────────────────────────────────────────────────────────────

function CommandList(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  let wrapperRef: HTMLDivElement | undefined;
  let sizerRef: HTMLDivElement | undefined;

  // Publish the intrinsic content height as `--cmdk-list-height` so consumers
  // can animate the list container (e.g. `height: var(--cmdk-list-height)`).
  onMount(() => {
    if (!wrapperRef || !sizerRef) return;
    const wrapper = wrapperRef;
    const sizer = sizerRef;
    let frame: number;
    const observer = new ResizeObserver(() => {
      frame = requestAnimationFrame(() => {
        wrapper.style.setProperty(
          "--cmdk-list-height",
          `${sizer.offsetHeight.toFixed(1)}px`,
        );
      });
    });
    observer.observe(sizer);
    onCleanup(() => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    });
  });

  return (
    <div
      ref={wrapperRef}
      data-slot="command-list"
      role="listbox"
      class={cn(
        "max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto p-1",
        local.class,
      )}
      {...rest}
    >
      <div ref={sizerRef} data-slot="command-list-sizer">
        {local.children}
      </div>
    </div>
  );
}

// ─── CommandEmpty ─────────────────────────────────────────────────────────────

function CommandEmpty(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  const ctx = useCommandCtx();

  return (
    <Show when={ctx.ready() && ctx.isEmpty() && !ctx.loading()}>
      <div
        data-slot="command-empty"
        class={cn(
          "py-6 text-center text-sm text-muted-foreground",
          local.class,
        )}
        {...rest}
      />
    </Show>
  );
}

// ─── CommandGroup ─────────────────────────────────────────────────────────────

interface CommandGroupProps extends Omit<ComponentProps<"div">, "heading"> {
  heading?: string;
  /** Keep the group rendered even when no child matches the current query. */
  forceMount?: boolean;
}

function CommandGroup(props: CommandGroupProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "heading",
    "forceMount",
    "children",
  ]);
  const ctx = useCommandCtx();
  const groupId = createUniqueId();

  // CSS-hide, not <Show> — unmounting would unmount child items and break their
  // registration. forceMount opts out of hiding entirely.
  const isHidden = () =>
    ctx.ready() && !local.forceMount && !ctx.hasVisibleItemsInGroup(groupId);

  return (
    <CommandGroupCtx.Provider value={{ groupId }}>
      <div
        data-slot="command-group"
        class={cn("p-1", isHidden() && "hidden", local.class)}
        {...rest}
      >
        {local.heading && (
          <div
            data-slot="command-group-heading"
            class="px-2 py-1.5 text-xs font-medium text-muted-foreground"
          >
            {local.heading}
          </div>
        )}
        {local.children}
      </div>
    </CommandGroupCtx.Provider>
  );
}

// ─── CommandSeparator ─────────────────────────────────────────────────────────

interface CommandSeparatorProps extends ComponentProps<"div"> {
  /** Render even when the user is searching. Default: hide while searching. */
  alwaysRender?: boolean;
}

function CommandSeparator(props: CommandSeparatorProps) {
  const [local, rest] = splitProps(props, ["class", "alwaysRender"]);
  const ctx = useCommandCtx();
  return (
    <Show when={local.alwaysRender || !ctx.query()}>
      <div
        data-slot="command-separator"
        class={cn("-mx-1 my-1 h-px bg-border", local.class)}
        {...rest}
      />
    </Show>
  );
}

// ─── CommandItem ──────────────────────────────────────────────────────────────

interface CommandItemProps extends Omit<ComponentProps<"div">, "onSelect"> {
  value: string;
  label: string;
  onSelect?: () => void;
  disabled?: boolean;
  /** Extra terms to match against when filtering — useful for synonyms. */
  keywords?: string[];
  /** Keep the item rendered even when it doesn't match the current query. */
  forceMount?: boolean;
  /**
   * Fired when this item becomes the highlighted (active) one — via hover,
   * keyboard nav, or the auto-highlight on filter change.
   */
  onHighlight?: () => void;
}

function CommandItem(props: CommandItemProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "value",
    "label",
    "onSelect",
    "disabled",
    "keywords",
    "forceMount",
    "onHighlight",
    "children",
  ]);
  const ctx = useCommandCtx();
  const groupCtx = useContext(CommandGroupCtx);
  let itemRef: HTMLDivElement | undefined;

  onMount(() => {
    ctx.register(
      {
        value: local.value,
        label: local.label,
        onSelect: local.onSelect,
        onHighlight: local.onHighlight,
        disabled: local.disabled,
        groupId: groupCtx?.groupId,
        keywords: local.keywords,
      },
      itemRef!,
    );
  });
  onCleanup(() => ctx.unregister(local.value));

  // CSS-hide, not <Show> — see file header. forceMount keeps it visible even
  // when filtered out (you'd prune it yourself if you didn't want it).
  return (
    <div
      ref={itemRef}
      data-slot="command-item"
      role="option"
      aria-selected={ctx.highlightedValue() === local.value}
      aria-disabled={local.disabled}
      data-highlighted={ctx.highlightedValue() === local.value ? "" : undefined}
      data-disabled={local.disabled ? "" : undefined}
      class={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none",
        "data-highlighted:bg-muted data-highlighted:text-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        !local.forceMount && !ctx.isVisible(local.value) && "hidden",
        local.class,
      )}
      onClick={() => {
        if (!local.disabled) local.onSelect?.();
      }}
      onMouseEnter={() => {
        if (!local.disabled && !ctx.disablePointerSelection())
          ctx.setHighlighted(local.value);
      }}
      {...rest}
    >
      {local.children}
    </div>
  );
}

// ─── CommandShortcut ──────────────────────────────────────────────────────────

function CommandShortcut(props: ComponentProps<"span">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <span
      data-slot="command-shortcut"
      class={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        local.class,
      )}
      {...rest}
    />
  );
}

// ─── CommandDialog ────────────────────────────────────────────────────────────

interface CommandDialogProps extends ComponentProps<
  typeof DialogPrimitive.Root
> {
  title?: string;
  description?: string;
  class?: string;
  children?: JSX.Element;
}

function CommandDialog(props: CommandDialogProps) {
  const [local, rest] = splitProps(props, [
    "title",
    "description",
    "class",
    "children",
  ]);

  return (
    <DialogPrimitive.Root {...rest}>
      <Portal>
        <DialogPrimitive.Backdrop class="fixed inset-0 z-50 bg-foreground/10 backdrop-blur-xs data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Positioner class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[20vh]">
          <DialogPrimitive.Content
            data-slot="command-dialog-content"
            class={cn(
              "w-full max-w-lg overflow-hidden rounded-xl bg-popover shadow-lg ring-1 ring-border outline-none",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
              local.class,
            )}
          >
            <DialogPrimitive.Title class="sr-only">
              {local.title ?? "Command palette"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description class="sr-only">
              {local.description ?? "Search for a command to run"}
            </DialogPrimitive.Description>
            {local.children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Positioner>
      </Portal>
    </DialogPrimitive.Root>
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
