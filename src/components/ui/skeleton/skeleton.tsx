/**
 * Skeleton — a pulsing placeholder for content that hasn't loaded.
 *
 * For page chrome — a sidebar, a card outline, a row of text. Give it the
 * size of what it stands in for.
 *
 * Usage:
 *   <Skeleton class="h-4 w-32" />
 *   <Skeleton class="size-10 rounded-full" />
 */
import { type ComponentProps, splitProps } from "solid-js";

import { cn } from "@/lib/utils";

function Skeleton(props: ComponentProps<"div">) {
  const [local, others] = splitProps(props, ["class"]);

  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      class={cn("animate-pulse rounded-md bg-muted", local.class)}
      {...others}
    />
  );
}

export { Skeleton };
