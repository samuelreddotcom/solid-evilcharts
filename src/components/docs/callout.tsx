/** An aside. `variant="warn"` for the things that cost someone an afternoon. */
import type { JSX } from "solid-js";

import { cn } from "../../lib/cn";

export function Callout(props: {
  variant?: "note" | "warn";
  title?: string;
  children: JSX.Element;
}) {
  return (
    <aside
      class={cn(
        "my-6 rounded-lg border-l-4 px-4 py-3 text-sm leading-7",
        props.variant === "warn"
          ? "border-l-destructive bg-destructive/5"
          : "border-l-primary bg-muted/50",
      )}
    >
      {props.title && <p class="mb-1 font-semibold">{props.title}</p>}
      {props.children}
    </aside>
  );
}
