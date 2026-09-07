/**
 * Command — searchable palette (think ⌘K).
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
 * returns a number in [0, 1], rewards word-boundary matches, penalises
 * skipped characters and transpositions. Items with score > 0 are visible.
 * `CommandItem` accepts an optional `keywords` array — useful when the
 * label is short ("Profile") but you want to match on synonyms
 * ("settings", "account").
 *
 * We do NOT reorder items by score — they stay in DOM order. Reordering
 * would require imperative DOM manipulation (cmdk's approach) or CSS `order`
 * tricks, and would also make keyboard nav feel non-linear. Stable order is
 * a better tradeoff than rank-perfect display for this size of palette.
 *
 * "DOM order" — not "registration order". Items can mount in arbitrary order
 * (a dynamic group rendered above the static one in JSX will mount later but
 * appear earlier visually). Keyboard nav must follow what the eye sees. So
 * `register()` takes the item's DOM element and sorts the registry by
 * `compareDocumentPosition` on every mount/unmount. Mount order is an
 * implementation detail; document position is the source of truth.
 *
 * To override, pass `filter` to `<Command>`:
 *   filter: (label, query, keywords?) => number
 *
 * ─── IMPORTANT: visibility uses CSS `hidden`, NOT `<Show>` ───────────────────
 *
 * CommandItem and CommandGroup hide themselves with the `hidden` Tailwind
 * class when filtered out. They stay in the DOM. We do NOT wrap them in
 * `<Show when={isVisible}>` even though that would be the natural Solid idiom.
 *
 * Why: items register themselves with the Command via `onMount` and
 * unregister via `onCleanup`. If we used `<Show>` to hide filtered items:
 *
 *   1. Type "xyz" in the search → no items match.
 *   2. <Show>s become false → CommandItems unmount.
 *   3. onCleanup fires on every item → registry is wiped.
 *   4. Clear the search → query is "" → would-be-visible items have no
 *      registration → CommandEmpty stays on screen → palette is dead.
 *
 * The same trap closes on first render if onMount races with the reactive
 * gate on CommandGroup: Group 1's items register, flip the gate, Group 2's
 * <Show> evaluates false before Group 2's items get a chance to mount and
 * register → Group 2 never appears.
 *
 * Rule of thumb: when a component owns a registration / subscription / any
 * side effect a parent depends on, **don't gate it with `<Show>` based on
 * data that side effect produces.** That's a circular dependency: the
 * unmount destroys the state that determined the mount. Use CSS visibility
 * instead — the component stays alive, the side effect persists, only the
 * pixels change.
 *
 * `<Show>` is still the right tool elsewhere in this file (CommandEmpty)
 * — it has no side effects to protect, and we genuinely want it gone
 * from the DOM when there are matches.
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
  onCleanup,
  onMount,
  splitProps,
  useContext,
} from "solid-js";
import { Portal } from "solid-js/web";

import { cn } from "../../../lib/cn";
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
   * Use this while an async source (network fetch, etc.) is in flight — it
   * avoids the "No results" flash between keystroke and result arrival.
   * The consumer is responsible for rendering a spinner somewhere visible.
   */
  loading?: boolean;
}

function Command(props: CommandProps) {
  // Registry stores the item data + its DOM element. The element is what lets
  // us order items by DOM position rather than mount order — important when
  // dynamic groups appear above static groups in the JSX but mount later.
  const registry = new Map<
    string,
    CommandItemData & { element: HTMLElement }
  >();
  const [orderedValues, setOrderedValues] = createSignal<string[]>([]);

  // Re-sort all registered values by their DOM document position. Called
  // whenever an item registers or unregisters. compareDocumentPosition is a
  // native browser API — fast, and authoritative about visual order.
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

  // Batched recompute — when N items mount in one tick (dynamic groups), we
  // want one sort, not N. queueMicrotask drains before paint, so the user
  // never sees the pre-sort state.
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
  const [highlighted, setHighlighted] = createSignal<string | null>(null);

  // `ready` gates CommandEmpty / CommandGroup hiding until the initial
  // registration pass has SETTLED. This is what prevents a "No results" flash
  // on a static list: items register synchronously in their onMount, but the
  // reorder that populates `orderedValues` fires in a queueMicrotask (see
  // scheduleRecompute). If we read isEmpty() before that microtask drains,
  // a fully-populated list looks empty for a tick.
  //
  // Earlier this was a one-way `hasRegistered` latch flipped inside register().
  // That broke genuinely-empty async lists: before the first fetch nothing ever
  // registers, so the latch stayed false forever and CommandEmpty never showed
  // on first load (while showing fine after any search+clear — an inconsistency).
  //
  // rAF runs after microtasks + layout, so by the time `ready` flips the
  // registry and ordering are fully synced — no flash for static lists, and an
  // empty-from-the-start list correctly shows CommandEmpty.
  const [ready, setReady] = createSignal(false);
  onMount(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    onCleanup(() => cancelAnimationFrame(raf));
  });

  const filterFn =
    props.filter ??
    ((label: string, q: string, keywords?: string[]) =>
      commandScore(label, q, keywords));

  // Visibility = matches the query (or no query). Disabled is a SEPARATE
  // dimension — disabled items still render (greyed via data-disabled styling),
  // they're just non-interactive and skipped by keyboard nav. This split avoids
  // the "registry hasn't synced yet" flicker that hid disabled items briefly,
  // then unhid them once a re-render triggered isVisible to re-evaluate.
  //
  // `orderedValues` is sorted by DOM document position (see `recomputeOrder`),
  // not registration order. So `visibleValues` reflects visual order, which
  // is what keyboard nav needs to feel linear.
  const visibleValues = createMemo(() => {
    const q = query();
    const ordered = orderedValues();
    if (!q) return ordered;
    return ordered.filter((v) => {
      const item = registry.get(v);
      if (!item) return false;
      return filterFn(item.label, q, item.keywords) > 0;
    });
  });

  // Derived lookups — memoized so per-item reactivity is O(1) per read.
  //
  //   visibleSet      — isVisible(value): O(1) Set.has vs O(N) Array.includes
  //   visibleGroupSet — hasVisibleItemsInGroup(id): O(1) vs O(V) scan
  //   navigableValues — keyboard nav: cached array (was a function, recomputed
  //                     on every keypress)
  //
  // Without these, a query change costs O(N²) total — each of N items reads
  // isVisible, each call walks N visible values. With these, it's O(N).
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

  // Keep highlight valid as filtered results change.
  createEffect(() => {
    const nav = navigableValues();
    const curr = highlighted();
    if (curr !== null && !nav.includes(curr)) {
      setHighlighted(nav[0] ?? null);
    } else if (curr === null && nav.length > 0 && query()) {
      // VENDOR DELTA: `!` for noUncheckedIndexedAccess. Guarded by
      // nav.length > 0, which TS can't narrow through. See VENDORED.md.
      setHighlighted(nav[0]!);
    }
  });

  // Single effect drives scroll-into-view + onHighlight callback. Previously
  // this lived per-item: N items × 2 effects, all re-running on every highlight
  // change. Most just did an equality check and bailed. Now: 1 effect, O(1)
  // lookup in the registry, one element scrolled, one callback fired.
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
      // No query → everything visible (disabled items render greyed, not hidden).
      // With a query → only items whose label matches the filter.
      if (!query()) return true;
      return visibleSet().has(value);
    },
    isEmpty: () => visibleValues().length === 0,
    hasVisibleItemsInGroup: (groupId) => visibleGroupSet().has(groupId),
    highlightedValue: highlighted,
    setHighlighted,
    ready,
    loading: () => props.loading ?? false,
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Arrow nav over navigable (non-disabled) items only — never land on
    // something the user can't activate.
    const nav = navigableValues();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = nav.indexOf(highlighted() ?? "");
      setHighlighted(nav[Math.min(idx + 1, nav.length - 1)] ?? null);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = nav.indexOf(highlighted() ?? "");
      setHighlighted(nav[Math.max(idx - 1, 0)] ?? null);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const value = highlighted();
      const item = value ? registry.get(value) : undefined;
      // Defense in depth — highlight already skips disabled, but in case state
      // gets out of sync, never call onSelect on a disabled item.
      if (item && !item.disabled) item.onSelect?.();
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
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="command-list"
      role="listbox"
      class={cn(
        "max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto p-1",
        local.class,
      )}
      {...rest}
    />
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
}

function CommandGroup(props: CommandGroupProps) {
  const [local, rest] = splitProps(props, ["class", "heading", "children"]);
  const ctx = useCommandCtx();
  const groupId = createUniqueId();

  // CSS-hide, not <Show> — see file header for why. Unmounting this would
  // unmount child CommandItems, breaking their registration.
  const isHidden = () => ctx.ready() && !ctx.hasVisibleItemsInGroup(groupId);

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
  // While searching, groups reorder by score — a separator between them
  // becomes a floating line with no meaningful boundary. `<Show>` is fine
  // here: no registration to protect.
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
  /**
   * Fired when this item becomes the highlighted (active) one — via mouse
   * hover, keyboard nav, or the auto-highlight on filter change. Useful for
   * showing contextual hints (e.g. a footer that previews the action that
   * Enter would trigger).
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
    "onHighlight",
    "children",
  ]);
  const ctx = useCommandCtx();
  const groupCtx = useContext(CommandGroupCtx);
  let itemRef: HTMLDivElement | undefined;

  onMount(() => {
    // itemRef is guaranteed by Solid to be set by the time onMount fires —
    // the div has been inserted into the DOM, so register can use its
    // document position to compute order. onHighlight + scrollIntoView are
    // driven from a single Command-level effect; we pass the callback up via
    // the registry rather than running a per-item effect.
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

  // CSS-hide, not <Show> — see file header. Unmounting would fire onCleanup
  // → unregister → item gone forever.
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
        !ctx.isVisible(local.value) && "hidden",
        local.class,
      )}
      onClick={() => {
        if (!local.disabled) local.onSelect?.();
      }}
      onMouseEnter={() => {
        if (!local.disabled) ctx.setHighlighted(local.value);
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
