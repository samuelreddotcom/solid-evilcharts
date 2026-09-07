import { Dialog as DialogPrimitive } from "@ark-ui/solid/dialog";
import { XIcon } from "lucide-solid";
import { type ComponentProps, splitProps } from "solid-js";
import { Portal } from "solid-js/web";

import { cn } from "../../../lib/cn";
import { buttonVariants } from "../button/button";

function Dialog(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose(
  props: ComponentProps<typeof DialogPrimitive.CloseTrigger>,
) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <DialogPrimitive.CloseTrigger
      data-slot="dialog-close"
      class={cn(buttonVariants({ variant: "outline" }), local.class)}
      {...rest}
    >
      {local.children ?? "Close"}
    </DialogPrimitive.CloseTrigger>
  );
}

function DialogOverlay(props: ComponentProps<typeof DialogPrimitive.Backdrop>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      class={cn(
        "fixed inset-0 z-50 bg-foreground/10 backdrop-blur-xs data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        local.class,
      )}
      {...rest}
    />
  );
}

function DialogContent(
  props: ComponentProps<typeof DialogPrimitive.Content> & {
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
      <DialogOverlay />
      <DialogPrimitive.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPrimitive.Content
          data-slot="dialog-content"
          class={cn(
            "relative grid w-full max-w-sm gap-4 rounded-xl bg-popover p-4 text-sm text-foreground ring-1 ring-border outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            local.class,
          )}
          {...rest}
        >
          {local.children}
          {(local.showCloseButton ?? true) && (
            <DialogPrimitive.CloseTrigger
              data-slot="dialog-close"
              class="absolute top-2 right-2 flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <XIcon class="size-4" />
              <span class="sr-only">Close</span>
            </DialogPrimitive.CloseTrigger>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Positioner>
    </Portal>
  );
}

function DialogHeader(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="dialog-header"
      class={cn("flex flex-col gap-2", local.class)}
      {...rest}
    />
  );
}

function DialogFooter(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="dialog-footer"
      class={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t border-border bg-muted/50 p-4 sm:flex-row sm:justify-end",
        local.class,
      )}
      {...rest}
    />
  );
}

function DialogTitle(props: ComponentProps<typeof DialogPrimitive.Title>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      class={cn("text-base leading-none font-medium", local.class)}
      {...rest}
    />
  );
}

function DialogDescription(
  props: ComponentProps<typeof DialogPrimitive.Description>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    />
  );
}

const DialogContext = DialogPrimitive.Context;

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
  DialogContext,
};
