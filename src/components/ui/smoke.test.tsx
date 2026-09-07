import { afterEach, describe, expect, it } from "vitest";
import { render } from "solid-js/web";
import type { JSX } from "solid-js";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";
import { Kbd, KbdGroup } from "./kbd";
import { ScrollArea } from "./scroll-area";
import { Separator } from "./separator";
import { Skeleton } from "./skeleton";
import { Spinner } from "./spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/**
 * Mount smoke tests for the vendored components.
 *
 * Scope, honestly: jsdom cannot compute `oklch()` or resolve `var()` chains, so
 * this proves nothing about colour. What it does prove is that each component
 * still *mounts* under this repo's Solid/Ark versions and emits its expected
 * DOM — which is what actually breaks when vendoring across repos.
 *
 * Colour correctness is covered statically by styles/tokens.test.ts and
 * ui/vendored-tokens.test.ts. Visual confirmation is the /previews route.
 */

const disposers: Array<() => void> = [];

afterEach(() => {
  while (disposers.length) disposers.pop()!();
});

function mount(ui: () => JSX.Element): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  disposers.push(render(ui, host));
  return host;
}

describe("vendored components mount", () => {
  it("Button renders every variant without throwing", () => {
    const variants = ["default", "brand", "outline", "ghost", "destructive", "link"] as const;
    for (const variant of variants) {
      const host = mount(() => <Button variant={variant}>{variant}</Button>);
      const button = host.querySelector("button");
      expect(button, `Button variant=${variant}`).not.toBeNull();
      expect(button!.className.length).toBeGreaterThan(0);
    }
  });

  it("Badge renders every variant without throwing", () => {
    const variants = [
      "default", "brand", "success", "warning", "destructive", "secondary", "outline",
    ] as const;
    for (const variant of variants) {
      const host = mount(() => <Badge variant={variant}>{variant}</Badge>);
      expect(host.textContent, `Badge variant=${variant}`).toBe(variant);
    }
  });

  it("Card renders its slots", () => {
    const host = mount(() => (
      <Card>
        <CardHeader>
          <CardTitle>Area Chart</CardTitle>
          <CardDescription>ECharts</CardDescription>
        </CardHeader>
        <CardContent>body</CardContent>
      </Card>
    ));
    expect(host.querySelector('[data-slot="card"]')).not.toBeNull();
    expect(host.textContent).toContain("Area Chart");
    expect(host.textContent).toContain("body");
  });

  it("Tabs renders triggers and the active panel", () => {
    const host = mount(() => (
      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>
        <TabsContent value="preview">chart goes here</TabsContent>
        <TabsContent value="code">source goes here</TabsContent>
      </Tabs>
    ));
    expect(host.textContent).toContain("Preview");
    expect(host.textContent).toContain("Code");
    expect(host.textContent).toContain("chart goes here");
  });

  it("Accordion renders items", () => {
    const host = mount(() => (
      <Accordion collapsible>
        <AccordionItem value="install">
          <AccordionTrigger>Installation</AccordionTrigger>
          <AccordionContent>copy it in</AccordionContent>
        </AccordionItem>
      </Accordion>
    ));
    expect(host.textContent).toContain("Installation");
  });

  it("Tooltip renders its trigger", () => {
    const host = mount(() => (
      <Tooltip>
        <TooltipTrigger>
          <Button variant="outline">Hover</Button>
        </TooltipTrigger>
        <TooltipContent>tip</TooltipContent>
      </Tooltip>
    ));
    expect(host.textContent).toContain("Hover");
  });

  it("Separator carries orientation semantics", () => {
    const host = mount(() => <Separator orientation="vertical" decorative={false} />);
    const el = host.querySelector('[data-slot="separator"]')!;
    expect(el.getAttribute("data-orientation")).toBe("vertical");
    expect(el.getAttribute("role")).toBe("separator");
  });

  it("Kbd, Spinner and Skeleton render", () => {
    const host = mount(() => (
      <>
        <KbdGroup>
          <Kbd>K</Kbd>
        </KbdGroup>
        <Spinner />
        <Skeleton class="h-4 w-32" />
      </>
    ));
    expect(host.querySelector('[data-slot="kbd"]')).not.toBeNull();
    expect(host.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(host.textContent).toContain("K");
  });

  it("ScrollArea renders a viewport around its children", () => {
    const host = mount(() => (
      <ScrollArea class="h-40">
        <p>scrollable body</p>
      </ScrollArea>
    ));
    expect(host.querySelector('[data-slot="scroll-area"]')).not.toBeNull();
    expect(host.textContent).toContain("scrollable body");
  });
});
