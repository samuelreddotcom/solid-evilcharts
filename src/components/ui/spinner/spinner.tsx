import { LoaderCircleIcon } from "lucide-solid";
import { type ComponentProps, splitProps } from "solid-js";

import { cn } from "../../../lib/cn";

export function Spinner(props: ComponentProps<"svg">) {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <LoaderCircleIcon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      class={cn("size-4 animate-spin", local.class)}
      {...others}
    />
  );
}
