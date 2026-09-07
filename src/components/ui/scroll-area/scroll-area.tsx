/**
 * ScrollArea — a scroll container with an overlay scrollbar that fades in on
 * hover or while scrolling, instead of the platform's native one.
 *
 * Not vendored: solid-foundation-design-system has no ScrollArea. Built on
 * Ark UI's `scroll-area` primitive, styled to this repo's tokens.
 *
 * The docs sidebar and long code blocks need this; native scrollbars on macOS
 * are invisible until scroll and take layout space on Windows, which shifts
 * the docs nav by ~15px between platforms.
 *
 * Ark drives visibility through data attributes on the scrollbar:
 *   data-hover / data-scrolling  → visible
 *   data-overflow-x / -y         → present only when that axis overflows
 * so a scrollbar for a non-overflowing axis is hidden outright.
 *
 * Usage:
 *   <ScrollArea class="h-72">
 *     <div class="p-4">…</div>
 *   </ScrollArea>
 *
 *   // Horizontal, e.g. a wide table
 *   <ScrollArea orientation="horizontal">…</ScrollArea>
 */
import { ScrollArea as Ark } from "@ark-ui/solid/scroll-area";
import { type JSX, splitProps } from "solid-js";

import { cn } from "../../../lib/cn";

export type ScrollAreaProps = Ark.RootProps & {
  children?: JSX.Element;
  /** Which scrollbars to render. Defaults to both. */
  orientation?: "vertical" | "horizontal" | "both";
  /** Class for the inner viewport, e.g. padding. */
  viewportClass?: string;
};

const scrollbar = cn(
  "flex touch-none select-none rounded-full",
  "bg-transparent p-px opacity-0 transition-opacity duration-150",
  "pointer-events-none",
  // Ark sets these while hovering the area or actively scrolling.
  "data-[hover]:pointer-events-auto data-[hover]:opacity-100",
  "data-[scrolling]:pointer-events-auto data-[scrolling]:opacity-100",
  // No transition when scrolling starts — the bar should appear instantly.
  "data-[scrolling]:duration-0",
  "data-vertical:w-2",
  "data-horizontal:h-2",
  // Hide the bar entirely when that axis doesn't overflow.
  "data-vertical:not-data-[overflow-y]:hidden",
  "data-horizontal:not-data-[overflow-x]:hidden",
);

const thumb = cn("bg-border rounded-full", "data-horizontal:h-full data-vertical:w-full");

function ScrollArea(props: ScrollAreaProps) {
  const [local, others] = splitProps(props, [
    "class",
    "children",
    "orientation",
    "viewportClass",
  ]);

  const orientation = () => local.orientation ?? "both";
  const shows = (axis: "vertical" | "horizontal") =>
    orientation() === "both" || orientation() === axis;

  return (
    <Ark.Root data-slot="scroll-area" class={cn("relative", local.class)} {...others}>
      <Ark.Viewport
        class={cn(
          "size-full overscroll-contain",
          // Ark renders its own scrollbar; suppress the native one.
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-[3px]",
          local.viewportClass,
        )}
      >
        <Ark.Content>{local.children}</Ark.Content>
      </Ark.Viewport>

      {shows("vertical") && (
        <Ark.Scrollbar orientation="vertical" class={scrollbar}>
          <Ark.Thumb class={thumb} />
        </Ark.Scrollbar>
      )}

      {shows("horizontal") && (
        <Ark.Scrollbar orientation="horizontal" class={scrollbar}>
          <Ark.Thumb class={thumb} />
        </Ark.Scrollbar>
      )}

      <Ark.Corner class="bg-transparent" />
    </Ark.Root>
  );
}

export { ScrollArea };
