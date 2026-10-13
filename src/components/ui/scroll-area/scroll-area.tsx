/**
 * ScrollArea — native scrolling with thin overlay scrollbars that appear on
 * hover/scroll (Ark UI scroll-area). Give the root a height or max-height.
 *
 * Usage:
 *   <ScrollArea class="h-72 rounded-md border border-border">
 *     <div class="p-4">…long content…</div>
 *   </ScrollArea>
 *
 *   <ScrollArea orientation="both">…wide + tall content…</ScrollArea>
 *   <ScrollArea class="h-40" viewportClass="p-4">…padding that scrolls…</ScrollArea>
 */
import { ScrollArea as ScrollAreaPrimitive } from "@ark-ui/solid/scroll-area";
import { type ComponentProps, Show, splitProps } from "solid-js";

import { cn } from "@/lib/utils";

type Orientation = "vertical" | "horizontal" | "both";

interface ScrollAreaProps extends ComponentProps<
  typeof ScrollAreaPrimitive.Root
> {
  /** Which scrollbars to render. Defaults to "vertical". */
  orientation?: Orientation;
  /** Classes for the inner viewport — e.g. padding that scrolls with content. */
  viewportClass?: string;
}

function ScrollAreaBody(props: {
  orientation: Orientation;
  viewportClass?: string;
  children: ComponentProps<"div">["children"];
}) {
  return (
    <>
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        class={cn(
          "size-full rounded-[inherit] outline-none",
          "focus-visible:ring-3 focus-visible:ring-ring/30",
          // Hide native scrollbars — ours overlay them.
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          props.viewportClass,
        )}
      >
        <ScrollAreaPrimitive.Content data-slot="scroll-area-content">
          {props.children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <Show when={props.orientation !== "horizontal"}>
        <ScrollAreaScrollbar orientation="vertical" />
      </Show>
      <Show when={props.orientation !== "vertical"}>
        <ScrollAreaScrollbar orientation="horizontal" />
      </Show>
      <ScrollAreaPrimitive.Corner />
    </>
  );
}

function ScrollArea(props: ScrollAreaProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "children",
    "orientation",
    "viewportClass",
  ]);
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      class={cn("relative overflow-hidden", local.class)}
      {...rest}
    >
      <ScrollAreaBody
        orientation={local.orientation ?? "vertical"}
        viewportClass={local.viewportClass}
      >
        {local.children}
      </ScrollAreaBody>
    </ScrollAreaPrimitive.Root>
  );
}

interface ScrollAreaRootProviderProps extends ComponentProps<
  typeof ScrollAreaPrimitive.RootProvider
> {
  orientation?: Orientation;
  viewportClass?: string;
}

/** Pair with `useScrollArea()` to read/drive scroll position from outside. */
function ScrollAreaRootProvider(props: ScrollAreaRootProviderProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "children",
    "orientation",
    "viewportClass",
  ]);
  return (
    <ScrollAreaPrimitive.RootProvider
      data-slot="scroll-area"
      class={cn("relative overflow-hidden", local.class)}
      {...rest}
    >
      <ScrollAreaBody
        orientation={local.orientation ?? "vertical"}
        viewportClass={local.viewportClass}
      >
        {local.children}
      </ScrollAreaBody>
    </ScrollAreaPrimitive.RootProvider>
  );
}

function ScrollAreaScrollbar(
  props: ComponentProps<typeof ScrollAreaPrimitive.Scrollbar>,
) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      class={cn(
        "flex touch-none p-px opacity-0 transition-opacity duration-150 select-none",
        "data-hover:opacity-100 data-scrolling:opacity-100 data-scrolling:duration-0",
        "data-[orientation=vertical]:w-2 data-[orientation=vertical]:not-data-overflow-y:hidden",
        "data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:not-data-overflow-x:hidden",
        local.class,
      )}
      {...rest}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        class="relative flex-1 rounded-full bg-foreground/20 transition-colors hover:bg-foreground/35 data-dragging:bg-foreground/35"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

const ScrollAreaContext = ScrollAreaPrimitive.Context;

export {
  ScrollArea,
  ScrollAreaRootProvider,
  ScrollAreaScrollbar,
  ScrollAreaContext,
};
export type { ScrollAreaProps };
export { useScrollArea, useScrollAreaContext } from "@ark-ui/solid/scroll-area";
