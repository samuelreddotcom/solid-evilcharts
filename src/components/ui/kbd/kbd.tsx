import { ComponentProps, splitProps } from "solid-js";

import { cn } from "../../../lib/cn";

function Kbd(props: ComponentProps<"kbd">) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <kbd
      data-slot="kbd"
      class={cn(
        "inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1",
        "rounded-sm bg-muted px-1",
        "border border-b-2 border-foreground/15",
        "font-mono text-xs font-medium text-muted-foreground",
        "pointer-events-none select-none",
        "[&_svg:not([class*='size-'])]:size-3",
        "in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background",
        local,
      )}
      {...others}
    />
  );
}

function KbdGroup(props: ComponentProps<"div">) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="kbd-group"
      class={cn("inline-flex items-center gap-1", local.class)}
      {...others}
    />
  );
}

export { Kbd, KbdGroup };
