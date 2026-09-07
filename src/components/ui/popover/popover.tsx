import { Popover as PopoverPrimitive } from "@ark-ui/solid/popover";
import { XIcon } from "lucide-solid";
import { type ComponentProps, splitProps } from "solid-js";
import { Portal } from "solid-js/web";

import { cn } from "../../../lib/cn";
import { buttonVariants } from "../button";

function Popover(props: ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(
  props: ComponentProps<typeof PopoverPrimitive.Trigger>,
) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverAnchor(props: ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverContent(
  props: ComponentProps<typeof PopoverPrimitive.Content> & {
    showCloseButton?: boolean;
  },
) {
  const [local, rest] = splitProps(props, [
    "class",
    "children",
    "showCloseButton",
  ]);
  return (
    <Portal>
      <PopoverPrimitive.Positioner>
        <PopoverPrimitive.Content
          data-slot="popover-content"
          class={cn(
            "z-50 w-72 rounded-lg border border-border p-4",
            "bg-popover text-sm text-popover-foreground shadow-md outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            local.class,
          )}
          {...rest}
        >
          {local.children}
          {local.showCloseButton && (
            <PopoverClose class="absolute top-2 right-2">
              <XIcon class="size-4" />
            </PopoverClose>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Positioner>
    </Portal>
  );
}

function PopoverHeader(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="popover-header"
      class={cn("flex flex-col gap-1", local.class)}
      {...rest}
    />
  );
}

function PopoverTitle(props: ComponentProps<typeof PopoverPrimitive.Title>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      class={cn("leading-none font-medium", local.class)}
      {...rest}
    />
  );
}

function PopoverDescription(
  props: ComponentProps<typeof PopoverPrimitive.Description>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      class={cn("text-muted-foreground", local.class)}
      {...rest}
    />
  );
}

function PopoverClose(
  props: ComponentProps<typeof PopoverPrimitive.CloseTrigger>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <PopoverPrimitive.CloseTrigger
      data-slot="popover-close"
      class={cn(
        buttonVariants({ variant: "ghost", size: "icon-sm" }),
        local.class,
      )}
      {...rest}
    />
  );
}

const PopoverContext = PopoverPrimitive.Context;

export {
  Popover,
  PopoverTrigger,
  PopoverAnchor,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverClose,
  PopoverContext,
};
