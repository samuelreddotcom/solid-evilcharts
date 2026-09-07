import {
  Menu as MenuPrimitive,
  MenuTriggerItemProps,
} from "@ark-ui/solid/menu";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-solid";
import { type ComponentProps, splitProps } from "solid-js";
import { Portal } from "solid-js/web";

import { cn } from "../../../lib/cn";

function DropdownMenu(props: ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

function DropdownMenuTrigger(
  props: ComponentProps<typeof MenuPrimitive.Trigger>,
) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

function DropdownMenuContent(
  props: ComponentProps<typeof MenuPrimitive.Content>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <Portal>
      <MenuPrimitive.Positioner>
        <MenuPrimitive.Content
          data-slot="dropdown-menu-content"
          class={cn(
            "isolate z-50 outline-none",
            "min-w-32 overflow-hidden rounded-lg p-1 text-sm",
            "border border-border bg-popover text-popover-foreground shadow-md",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            local.class,
          )}
          {...rest}
        />
      </MenuPrimitive.Positioner>
    </Portal>
  );
}

interface DropdownMenuItemProps extends ComponentProps<
  typeof MenuPrimitive.Item
> {
  variant?: "default" | "destructive";
}

function DropdownMenuItem(props: DropdownMenuItemProps) {
  const [local, rest] = splitProps(props, ["class", "variant"]);
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={local.variant}
      class={cn(
        "relative flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 transition-colors outline-none select-none",
        "data-highlighted:bg-muted",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:shrink-0 [&_svg]:text-muted-foreground [&_svg:not([class*='size-'])]:size-4",
        "data-[variant=destructive]:text-destructive data-[variant=destructive]:[&_svg]:text-destructive",
        "data-[variant=destructive]:data-highlighted:bg-destructive/10 data-[variant=destructive]:data-highlighted:text-destructive",
        "not-data-[variant=destructive]:data-highlighted:**:tpopover-ext-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive",
        local.class,
      )}
      {...rest}
    />
  );
}

function DropdownMenuGroup(
  props: ComponentProps<typeof MenuPrimitive.ItemGroup>,
) {
  return <MenuPrimitive.ItemGroup data-slot="dropdown-menu-group" {...props} />;
}

function DropdownMenuLabel(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="dropdown-menu-label"
      class={cn(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground",
        local.class,
      )}
      {...rest}
    />
  );
}

function DropdownMenuSeparator(
  props: ComponentProps<typeof MenuPrimitive.Separator>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      class={cn("-mx-1 my-1 h-px bg-border", local.class)}
      {...rest}
    />
  );
}

function DropdownMenuCheckboxItem(
  props: ComponentProps<typeof MenuPrimitive.CheckboxItem>,
) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      class={cn(
        "relative flex items-center justify-between gap-2 rounded-md px-2 py-1.5",
        "cursor-default transition-colors outline-none select-none",
        "data-highlighted:bg-muted",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        local.class,
      )}
      {...rest}
    >
      {local.children}
      <span class="flex size-4 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <CheckIcon class="size-4" />
        </MenuPrimitive.ItemIndicator>
      </span>
    </MenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioGroup(
  props: ComponentProps<typeof MenuPrimitive.RadioItemGroup>,
) {
  return (
    <MenuPrimitive.RadioItemGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

function DropdownMenuRadioItem(
  props: ComponentProps<typeof MenuPrimitive.RadioItem>,
) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      class={cn(
        "relative flex items-center justify-between gap-2 rounded-md px-2 py-1.5",
        "cursor-default transition-colors outline-none select-none",
        "data-highlighted:bg-muted",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        local.class,
      )}
      {...rest}
    >
      {local.children}
      <span class="flex size-4 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <CircleIcon class="size-2 fill-current" />
        </MenuPrimitive.ItemIndicator>
      </span>
    </MenuPrimitive.RadioItem>
  );
}

function DropdownMenuSub(props: ComponentProps<typeof MenuPrimitive.Root>) {
  return <MenuPrimitive.Root data-slot="dropdown-menu-sub" {...props} />;
}

function DropdownMenuSubTrigger(props: MenuTriggerItemProps) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <MenuPrimitive.TriggerItem
      data-slot="dropdown-menu-sub-trigger"
      class={cn(
        "flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 transition-colors outline-none select-none",
        "data-highlighted:bg-muted data-[state=open]:bg-muted",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        local.class,
      )}
      {...rest}
    >
      {local.children}
      <ChevronRightIcon class="ml-auto size-4" />
    </MenuPrimitive.TriggerItem>
  );
}

function DropdownMenuSubContent(
  props: ComponentProps<typeof MenuPrimitive.Content>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <Portal>
      <MenuPrimitive.Positioner>
        <MenuPrimitive.Content
          data-slot="dropdown-menu-sub-content"
          class={cn(
            "z-50 min-w-32 overflow-hidden rounded-lg p-1 outline-none",
            "border border-border bg-popover text-sm text-popover-foreground shadow-lg",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            local.class,
          )}
          {...rest}
        />
      </MenuPrimitive.Positioner>
    </Portal>
  );
}

function DropdownMenuShortcut(props: ComponentProps<"span">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      class={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        local.class,
      )}
      {...rest}
    />
  );
}

const DropdownMenuContext = MenuPrimitive.Context;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuShortcut,
  DropdownMenuContext,
};
