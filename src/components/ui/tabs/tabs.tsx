import { Tabs as TabsPrimitive } from "@ark-ui/solid/tabs";
import type { ComponentProps } from "solid-js";
import { mergeProps, splitProps } from "solid-js";

import { cn } from "../../../lib/cn";

interface TabsListProps extends ComponentProps<typeof TabsPrimitive.List> {
  variant?: "default" | "line";
}

function Tabs(props: ComponentProps<typeof TabsPrimitive.Root>) {
  const merged = mergeProps({ activationMode: "manual" as const }, props);
  const [local, rest] = splitProps(merged, ["class"]);
  return (
    <TabsPrimitive.Root
      class={cn("group/tabs flex flex-col gap-2", local.class)}
      {...rest}
    />
  );
}

function TabsList(props: TabsListProps) {
  const [local, rest] = splitProps(props, ["class", "variant"]);
  return (
    <TabsPrimitive.List
      data-variant={local.variant ?? "default"}
      class={cn(
        "group/tabs-list inline-flex items-center",
        // default: pill container
        "data-[variant=default]:gap-1 data-[variant=default]:rounded-lg data-[variant=default]:bg-muted data-[variant=default]:p-1",
        // line: border-bottom strip
        "data-[variant=line]:w-full data-[variant=line]:gap-0 data-[variant=line]:border-b data-[variant=line]:border-border",
        local.class,
      )}
      {...rest}
    />
  );
}

function TabsTrigger(props: ComponentProps<typeof TabsPrimitive.Trigger>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <TabsPrimitive.Trigger
      class={cn(
        "relative inline-flex cursor-pointer items-center justify-center gap-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors",
        "hover:text-foreground",
        // focus: subtle inset ring, not a selection-looking box
        "outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/40",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-3.5",

        // default (pill) variant
        "group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:px-3 group-data-[variant=default]/tabs-list:py-1",
        "group-data-[variant=default]/tabs-list:data-selected:bg-background group-data-[variant=default]/tabs-list:data-selected:text-foreground group-data-[variant=default]/tabs-list:data-selected:shadow-sm",

        // line variant
        "group-data-[variant=line]/tabs-list:px-3 group-data-[variant=line]/tabs-list:py-2",
        "group-data-[variant=line]/tabs-list:data-selected:text-foreground",
        // underline indicator via ::after — sits on the list's border, fades in
        "after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-foreground after:opacity-0 after:transition-opacity",
        "group-data-[variant=line]/tabs-list:data-selected:after:opacity-100",

        local.class,
      )}
      {...rest}
    />
  );
}

function TabsContent(props: ComponentProps<typeof TabsPrimitive.Content>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <TabsPrimitive.Content
      class={cn("focus-visible:outline-none", local.class)}
      {...rest}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
