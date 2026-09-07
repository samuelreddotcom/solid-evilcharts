/**
 * Separator — a thin rule that visually or semantically divides content.
 *
 * Ark UI has no Separator primitive, so this is a plain element with the right
 * ARIA semantics. Orientation drives the `data-orientation` attribute, which
 * the `data-horizontal` / `data-vertical` custom variants key off of.
 *
 * Decorative separators (the default) are purely visual and hidden from the
 * a11y tree (`role="none"`). Set `decorative={false}` when the divide is
 * meaningful to assistive tech (e.g. between groups in a menu) — it then
 * exposes `role="separator"` with the correct orientation.
 *
 * Usage:
 *   <Separator />
 *   <Separator orientation="vertical" />
 *   <Separator decorative={false} />
 */
import { type ComponentProps, splitProps } from "solid-js";

import { cn } from "../../../lib/cn";

export type SeparatorProps = ComponentProps<"div"> & {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
};

function Separator(props: SeparatorProps) {
  const [local, others] = splitProps(props, [
    "class",
    "orientation",
    "decorative",
  ]);

  const orientation = () => local.orientation ?? "horizontal";
  const decorative = () => local.decorative ?? true;

  return (
    <div
      data-slot="separator"
      data-orientation={orientation()}
      role={decorative() ? "none" : "separator"}
      // Horizontal is the implicit ARIA default, so only announce vertical.
      aria-orientation={
        !decorative() && orientation() === "vertical" ? "vertical" : undefined
      }
      class={cn(
        "shrink-0 bg-border",
        "data-horizontal:h-px data-horizontal:w-full",
        "data-vertical:w-px data-vertical:self-stretch",
        local.class,
      )}
      {...others}
    />
  );
}

export { Separator };
