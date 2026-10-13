/**
 * Select — Ark UI's select machine, styled.
 *
 * Usage:
 *   const frameworks = createListCollection({ items: [...] });
 *   <Select collection={frameworks}>
 *     <SelectLabel>Framework</SelectLabel>
 *     <SelectControl>
 *       <SelectTrigger>
 *         <SelectValueText placeholder="Pick one" />
 *       </SelectTrigger>
 *     </SelectControl>
 *     <SelectContent>
 *       <Index each={frameworks.items}>
 *         {(item) => <SelectItem item={item()}>{item().label}</SelectItem>}
 *       </Index>
 *       <SelectEmpty />
 *     </SelectContent>
 *   </Select>
 *
 * Controlled from outside: `const select = useSelect({...})` +
 * `<SelectRootProvider value={select}>`.
 */
import {
  Select as SelectPrimitive,
  useSelectContext,
} from "@ark-ui/solid/select";
import type {
  SelectContentProps,
  SelectItemGroupProps,
  SelectItemProps,
  SelectLabelProps,
  SelectRootProps,
  SelectTriggerProps,
  SelectValueTextProps,
} from "@ark-ui/solid/select";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-solid";
import { type ComponentProps, type JSX, Show, splitProps } from "solid-js";
import { Portal } from "solid-js/web";

import { cn } from "@/lib/utils";

function SelectLabel(props: SelectLabelProps) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      class={cn("mb-1.5 text-sm leading-none font-medium", local.class)}
      {...rest}
    />
  );
}

interface SelectControlProps extends ComponentProps<
  typeof SelectPrimitive.Control
> {
  /** Custom clear trigger icon. Pass `false` to hide. Defaults to <XIcon />. */
  clearTrigger?: JSX.Element | false;
  /** Custom chevron indicator. Pass `false` to hide. Defaults to <ChevronDownIcon />. */
  indicator?: JSX.Element | false;
}

function SelectControl(props: SelectControlProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "children",
    "clearTrigger",
    "indicator",
  ]);
  return (
    <SelectPrimitive.Control
      data-slot="select-control"
      class={cn(
        "relative flex h-9 w-full items-center rounded-md border border-border bg-popover text-sm text-foreground",
        "transition-colors",
        "has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/20",
        "data-invalid:border-destructive",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        local.class,
      )}
      {...rest}
    >
      {local.children}
      <Show when={local.clearTrigger !== false || local.indicator !== false}>
        <div class="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-2">
          <Show when={local.clearTrigger !== false}>
            <SelectPrimitive.ClearTrigger class="pointer-events-auto flex shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground">
              {local.clearTrigger ?? <XIcon class="size-3.5" />}
            </SelectPrimitive.ClearTrigger>
          </Show>
          <Show when={local.indicator !== false}>
            <SelectPrimitive.Indicator class="shrink-0 text-muted-foreground transition-transform data-[state=open]:rotate-180">
              {local.indicator ?? <ChevronDownIcon class="size-4" />}
            </SelectPrimitive.Indicator>
          </Show>
        </div>
      </Show>
    </SelectPrimitive.Control>
  );
}

function SelectTrigger(props: SelectTriggerProps) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      class={cn(
        "flex h-full flex-1 items-center outline-none",
        "pr-10 pl-3",
        local.class,
      )}
      {...rest}
    >
      {local.children}
    </SelectPrimitive.Trigger>
  );
}

function SelectValueText(props: SelectValueTextProps) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <SelectPrimitive.ValueText
      data-slot="select-value-text"
      class={cn(
        "flex-1 truncate text-left data-[state=placeholder]:text-muted-foreground",
        local.class,
      )}
      {...rest}
    />
  );
}

function SelectContent(props: SelectContentProps) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <Portal>
      <SelectPrimitive.Positioner>
        <SelectPrimitive.Content
          data-slot="select-content"
          class={cn(
            "min-w-(--reference-width)",
            "z-50 overflow-hidden rounded-lg border border-border bg-popover p-1 text-sm text-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            local.class,
          )}
          {...rest}
        />
      </SelectPrimitive.Positioner>
    </Portal>
  );
}

function SelectItem(props: SelectItemProps) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      class={cn(
        "relative flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 outline-none select-none",
        "transition-colors",
        "data-highlighted:bg-muted",
        "data-[state=checked]:font-medium",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        local.class,
      )}
      {...rest}
    >
      <SelectPrimitive.ItemText>{local.children}</SelectPrimitive.ItemText>
      <span class="flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon class="size-3.5" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

function SelectItemGroup(props: SelectItemGroupProps) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <SelectPrimitive.ItemGroup
      data-slot="select-item-group"
      class={cn("scroll-my-1 p-1", local.class)}
      {...rest}
    />
  );
}

function SelectItemGroupLabel(
  props: ComponentProps<typeof SelectPrimitive.ItemGroupLabel>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <SelectPrimitive.ItemGroupLabel
      data-slot="select-item-group-label"
      class={cn("px-1.5 py-1 text-xs text-muted-foreground", local.class)}
      {...rest}
    />
  );
}

const SelectContext = SelectPrimitive.Context;

function Select<T>(props: SelectRootProps<T>) {
  return (
    <SelectPrimitive.Root<T> data-slot="select" {...props}>
      {props.children}
      <SelectPrimitive.HiddenSelect data-slot="select-hidden-select" />
    </SelectPrimitive.Root>
  );
}

/** Pair with `useSelect()` to drive the select from outside. */
function SelectRootProvider<T>(
  props: ComponentProps<typeof SelectPrimitive.RootProvider<T>>,
) {
  return (
    <SelectPrimitive.RootProvider<T> data-slot="select" {...props}>
      {props.children}
      <SelectPrimitive.HiddenSelect data-slot="select-hidden-select" />
    </SelectPrimitive.RootProvider>
  );
}

function SelectSeparator(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="select-separator"
      class={cn("pointer-events-none -mx-1 my-1 h-px bg-border", local.class)}
      {...rest}
    />
  );
}

function SelectEmpty(props: ComponentProps<"div">) {
  const select = useSelectContext();
  const [local, rest] = splitProps(props, ["class", "children"]);
  // Reactive: re-evaluates as the collection is filtered.
  return (
    <Show when={select().collection.size === 0}>
      <div
        data-slot="select-empty"
        role="presentation"
        class={cn("p-2 text-center text-sm text-muted-foreground", local.class)}
        {...rest}
      >
        {local.children ?? "No results"}
      </div>
    </Show>
  );
}

export {
  Select,
  SelectRootProvider,
  SelectLabel,
  SelectControl,
  SelectTrigger,
  SelectValueText,
  SelectContent,
  SelectItem,
  SelectItemGroup,
  SelectItemGroupLabel,
  SelectEmpty,
  SelectSeparator,
  SelectContext,
};
export {
  createListCollection,
  useSelect,
  useSelectContext,
} from "@ark-ui/solid/select";
