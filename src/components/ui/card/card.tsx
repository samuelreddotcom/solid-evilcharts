/**
 * Card — a surface container with optional header, content, and footer.
 *
 * Two clever bits inherited from shadcn:
 *   1. Drop an <img /> as the first child and Card auto-removes its top
 *      padding and rounds the image's top corners — clean image header.
 *   2. CardHeader uses a CSS grid that auto-flips between 1- and 2-column
 *      layouts based on whether CardAction is present.
 *
 *   <Card>
 *     <CardHeader>
 *       <CardTitle>Title</CardTitle>
 *       <CardDescription>Description</CardDescription>
 *       <CardAction><Button>Edit</Button></CardAction>
 *     </CardHeader>
 *     <CardContent>...</CardContent>
 *     <CardFooter>...</CardFooter>
 *   </Card>
 */
import { type ComponentProps, splitProps } from "solid-js";

import { cn } from "../../../lib/cn";

type CardSize = "default" | "sm";

interface CardProps extends ComponentProps<"div"> {
  size?: CardSize;
}

function Card(props: CardProps) {
  const [local, rest] = splitProps(props, ["class", "size"]);
  return (
    <div
      data-slot="card"
      data-size={local.size ?? "default"}
      class={cn(
        "group/card flex flex-col gap-4 overflow-hidden rounded-xl bg-popover py-4 text-sm text-foreground ring-1 ring-border",
        // No bottom padding when there's a footer — footer brings its own padding + bg
        "has-data-[slot=card-footer]:pb-0",
        // No top padding when first child is an image — let it flush to the edge
        "has-[>img:first-child]:pt-0 [&>img:first-child]:rounded-t-xl",
        // Same idea for trailing images
        "[&>img:last-child]:rounded-b-xl",
        // Small size — tighter gaps + padding
        "data-[size=sm]:gap-3 data-[size=sm]:py-3",
        local.class,
      )}
      {...rest}
    />
  );
}

function CardHeader(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-header"
      class={cn(
        "grid auto-rows-min items-start gap-1 px-4",
        // Add a second column when a CardAction is present
        "has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        // Ensure two rows when there's a description (so action can row-span both)
        "has-data-[slot=card-description]:grid-rows-[auto_auto]",
        "group-data-[size=sm]/card:px-3",
        local.class,
      )}
      {...rest}
    />
  );
}

function CardTitle(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-title"
      class={cn(
        "text-base leading-snug font-medium",
        "group-data-[size=sm]/card:text-sm",
        local.class,
      )}
      {...rest}
    />
  );
}

function CardDescription(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-description"
      class={cn("text-sm text-muted-foreground", local.class)}
      {...rest}
    />
  );
}

function CardAction(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-action"
      class={cn(
        // Pinned to the top-right of the header grid, spanning both rows
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        local.class,
      )}
      {...rest}
    />
  );
}

function CardContent(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-content"
      class={cn("px-4", "group-data-[size=sm]/card:px-3", local.class)}
      {...rest}
    />
  );
}

function CardFooter(props: ComponentProps<"div">) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <div
      data-slot="card-footer"
      class={cn(
        // Matches DialogFooter / SheetFooter convention — distinct bg, top border
        "flex items-center gap-2 rounded-b-xl border-t border-border bg-muted/50 p-4",
        "group-data-[size=sm]/card:p-3",
        local.class,
      )}
      {...rest}
    />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
};
