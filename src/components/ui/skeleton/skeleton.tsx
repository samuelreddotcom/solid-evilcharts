/**
 * Skeleton — a pulsing placeholder for content that hasn't loaded.
 *
 * Not vendored: solid-foundation-design-system has no Skeleton. Written here to
 * match its conventions (data-slot, splitProps, cn) so it can be upstreamed
 * as-is if that repo ever wants one.
 *
 * Note this is for *page chrome* — a docs sidebar or a card outline. Charts
 * have their own loading state: EvilCharts draws a clipped shimmer sweep inside
 * the canvas rather than covering it with a grey block. Don't reach for this to
 * wrap a chart.
 *
 * Usage:
 *   <Skeleton class="h-4 w-32" />
 *   <Skeleton class="size-10 rounded-full" />
 */
import { type ComponentProps, splitProps } from "solid-js";

import { cn } from "../../../lib/cn";

function Skeleton(props: ComponentProps<"div">) {
  const [local, others] = splitProps(props, ["class"]);

  return (
    <div
      data-slot="skeleton"
      class={cn("bg-muted animate-pulse rounded-md", local.class)}
      {...others}
    />
  );
}

export { Skeleton };
