import { createFileRoute } from "@tanstack/solid-router";
import { For, createSignal, onMount, type JSX } from "solid-js";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../components/ui/accordion";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Kbd, KbdGroup } from "../components/ui/kbd";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";

export const Route = createFileRoute("/previews")({
  component: Previews,
});

/**
 * The four classes resolveColors() probes. It appends a throwaway span, sets
 * className, and reads getComputedStyle().color — so this panel is a faithful
 * in-browser rehearsal of the chart color pipeline. Anything showing "—" here
 * means every chart would silently fall back to grey.
 */
const PROBE_CLASSES = [
  "text-muted-foreground",
  "text-border",
  "text-foreground",
  "text-background",
] as const;

function TokenProbe() {
  const [resolved, setResolved] = createSignal<Record<string, string>>({});
  let host!: HTMLDivElement;

  const probe = () => {
    const span = document.createElement("span");
    span.style.cssText = "position:absolute;width:0;height:0;visibility:hidden;";
    host.appendChild(span);
    const out: Record<string, string> = {};
    for (const cls of PROBE_CLASSES) {
      span.className = cls;
      out[cls] = getComputedStyle(span).color || "—";
    }
    host.removeChild(span);
    setResolved(out);
  };

  onMount(probe);

  return (
    <div ref={host} class="relative">
      <div class="flex items-center gap-3">
        <p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          resolveColors probe
        </p>
        <Button size="sm" variant="outline" onClick={probe}>
          Re-probe
        </Button>
      </div>
      <table class="mt-3 w-full text-sm">
        <tbody>
          <For each={PROBE_CLASSES}>
            {(cls) => (
              <tr class="border-border border-b last:border-0">
                <td class="py-1.5 pr-4 font-mono text-xs">{cls}</td>
                <td class="py-1.5 pr-4 font-mono text-xs">{resolved()[cls] ?? "—"}</td>
                <td class="py-1.5">
                  <span
                    class="border-border inline-block size-4 rounded border align-middle"
                    style={{ background: resolved()[cls] ?? "transparent" }}
                  />
                </td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}

function Section(props: { title: string; children: JSX.Element }) {
  return (
    <section class="flex flex-col gap-3">
      <p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {props.title}
      </p>
      <div class="flex flex-wrap items-start gap-4">{props.children}</div>
    </section>
  );
}

function Previews() {
  const [dark, setDark] = createSignal(false);

  const toggle = () => {
    const next = !dark();
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <div class="mx-auto flex max-w-3xl flex-col gap-10 p-8">
      <header class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-lg font-semibold">Phase 2 — tokens &amp; vendored UI</h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Verifies the EvilCharts token set renders correctly and every vendored
            component still works under it.
          </p>
        </div>
        <Button variant="outline" onClick={toggle}>
          {dark() ? "Light" : "Dark"}
        </Button>
      </header>

      <TokenProbe />

      <Separator />

      <Section title="Button">
        <Button>Default</Button>
        <Button variant="brand">Brand</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </Section>

      {/* brand / success / warning are the tokens added for the vendored
          components — EvilCharts has none. If any of these render colourless,
          the dark or light block lost a value. */}
      <Section title="Badge — incl. the added brand/success/warning tokens">
        <Badge>Default</Badge>
        <Badge variant="brand">Brand</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
      </Section>

      <Section title="Card">
        <Card class="w-72">
          <CardHeader>
            <CardTitle>Area Chart</CardTitle>
            <CardDescription>Powered by Apache ECharts</CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton class="h-24 w-full" />
          </CardContent>
        </Card>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="preview">
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>
          <TabsContent value="preview" class="text-muted-foreground pt-3 text-sm">
            The chart renders here.
          </TabsContent>
          <TabsContent value="code" class="pt-3">
            <pre class="bg-code text-code-foreground rounded-md p-3 font-mono text-xs">
              {`<AreaChart data={data} />`}
            </pre>
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Accordion">
        <Accordion class="w-full" collapsible>
          <AccordionItem value="install">
            <AccordionTrigger>Installation</AccordionTrigger>
            <AccordionContent class="text-muted-foreground text-sm">
              Copy the component into your project.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="usage">
            <AccordionTrigger>Usage</AccordionTrigger>
            <AccordionContent class="text-muted-foreground text-sm">
              Import it and pass data.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      <Section title="Tooltip">
        <Tooltip>
          <TooltipTrigger>
            <Button variant="outline">Hover me</Button>
          </TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>
      </Section>

      <Section title="Kbd, Spinner, Separator">
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
        <Spinner />
        <div class="flex h-6 items-center gap-3">
          <span class="text-sm">left</span>
          <Separator orientation="vertical" />
          <span class="text-sm">right</span>
        </div>
      </Section>

      <Section title="ScrollArea">
        <ScrollArea class="border-border h-40 w-full rounded-md border" viewportClass="p-4">
          <div class="flex flex-col gap-2">
            <For each={Array.from({ length: 20 }, (_, i) => i + 1)}>
              {(n) => <p class="text-sm">Scrollable row {n}</p>}
            </For>
          </div>
        </ScrollArea>
      </Section>

      <Section title="Chart palette (--chart-1…5)">
        <div class="flex gap-2">
          <For each={[1, 2, 3, 4, 5]}>
            {(n) => (
              <div class="flex flex-col items-center gap-1">
                <div
                  class="border-border size-10 rounded-md border"
                  style={{ background: `var(--chart-${n})` }}
                />
                <span class="text-muted-foreground font-mono text-[10px]">{n}</span>
              </div>
            )}
          </For>
        </div>
      </Section>
    </div>
  );
}
