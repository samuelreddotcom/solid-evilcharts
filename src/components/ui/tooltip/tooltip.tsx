import { Tooltip as TooltipPrimitive } from "@ark-ui/solid/tooltip";
import { mergeProps, type ComponentProps, splitProps } from "solid-js";
import { Portal } from "solid-js/web";

import { cn } from "../../../lib/cn";

function Tooltip(props: ComponentProps<typeof TooltipPrimitive.Root>) {
  const merged = mergeProps(
    { openDelay: 400, closeDelay: 0, lazyMount: true, unmountOnExit: true },
    props,
  );
  return <TooltipPrimitive.Root data-slot="tooltip" {...merged} />;
}

function TooltipTrigger(
  props: ComponentProps<typeof TooltipPrimitive.Trigger>,
) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent(
  props: ComponentProps<typeof TooltipPrimitive.Content>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <Portal>
      <TooltipPrimitive.Positioner>
        <TooltipPrimitive.Content
          data-slot="tooltip-content"
          class={cn(
            "z-50 rounded-md bg-foreground px-2.5 py-1.5 text-xs text-popover shadow-md",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            local.class,
          )}
          {...rest}
        />
      </TooltipPrimitive.Positioner>
    </Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent };
