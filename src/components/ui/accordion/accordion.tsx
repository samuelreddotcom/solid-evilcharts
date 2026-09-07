import { Accordion as AccordionPrimitive } from "@ark-ui/solid/accordion";
import { ChevronDownIcon } from "lucide-solid";
import { type ComponentProps, splitProps } from "solid-js";

import { cn } from "../../../lib/cn";

function Accordion(props: ComponentProps<typeof AccordionPrimitive.Root>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      class={cn("flex w-full flex-col", local.class)}
      {...rest}
    />
  );
}

function AccordionItem(props: ComponentProps<typeof AccordionPrimitive.Item>) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      class={cn("border-border not-last:border-b", local.class)}
      {...rest}
    />
  );
}

function AccordionTrigger(
  props: ComponentProps<typeof AccordionPrimitive.ItemTrigger>,
) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <AccordionPrimitive.ItemTrigger
      data-slot="accordion-trigger"
      class={cn(
        "flex w-full flex-1 items-center justify-between py-2.5 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        local.class,
      )}
      {...rest}
    >
      {local.children}
      <AccordionPrimitive.ItemIndicator class="ml-auto shrink-0 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180">
        <ChevronDownIcon class="size-4" />
      </AccordionPrimitive.ItemIndicator>
    </AccordionPrimitive.ItemTrigger>
  );
}

function AccordionContent(
  props: ComponentProps<typeof AccordionPrimitive.ItemContent>,
) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <AccordionPrimitive.ItemContent
      data-slot="accordion-content"
      class="overflow-hidden text-sm"
      {...rest}
    >
      <div class={cn("pt-0 pb-2.5", local.class)}>{local.children}</div>
    </AccordionPrimitive.ItemContent>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
