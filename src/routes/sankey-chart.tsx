import { createFileRoute } from "@tanstack/solid-router";
import { For, createSignal, type JSX } from "solid-js";

import { EChartsSankeyChart } from "../registry/charts/sankey-chart";
import type {
  ChartConfig,
  EChartsRenderer,
  LinkVariant,
  SankeyData,
} from "../registry/charts/sankey-chart";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/sankey-chart")({
  component: SankeyChartDemo,
});

const DATA: SankeyData = {
  nodes: [
    { name: "direct" },
    { name: "search" },
    { name: "social" },
    { name: "landing" },
    { name: "pricing" },
    { name: "signup" },
    { name: "churn" },
  ],
  links: [
    { source: 0, target: 3, value: 120 },
    { source: 1, target: 3, value: 200 },
    { source: 2, target: 3, value: 80 },
    { source: 3, target: 4, value: 260 },
    { source: 3, target: 6, value: 140 },
    { source: 4, target: 5, value: 180 },
    { source: 4, target: 6, value: 80 },
  ],
};

const CONFIG: ChartConfig = {
  direct: { label: "Direct", colors: { light: ["#047857"], dark: ["#10b981"] } },
  search: { label: "Search", colors: { light: ["#0369a1"], dark: ["#38bdf8"] } },
  social: { label: "Social", colors: { light: ["#7c3aed"], dark: ["#a78bfa"] } },
  landing: { label: "Landing", colors: { light: ["#a16207"], dark: ["#fbbf24"] } },
  pricing: { label: "Pricing", colors: { light: ["#0f766e"], dark: ["#2dd4bf"] } },
  signup: { label: "Signup", colors: { light: ["#15803d"], dark: ["#4ade80"] } },
  churn: { label: "Churn", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
};

const LINK_VARIANTS: LinkVariant[] = ["gradient", "solid", "source", "target"];

function Demo(props: { title: string; note?: string; children: JSX.Element }) {
  return (
    <section class="flex flex-col gap-2">
      <div>
        <h2 class="text-sm font-medium">{props.title}</h2>
        {props.note && <p class="text-muted-foreground text-xs">{props.note}</p>}
      </div>
      <div class="border-border h-80 rounded-lg border p-2">{props.children}</div>
    </section>
  );
}

function SankeyChartDemo() {
  const [dark, setDark] = createSignal(false);
  const [renderer, setRenderer] = createSignal<EChartsRenderer>("canvas");
  const [loading, setLoading] = createSignal(false);
  const [replay, setReplay] = createSignal(0);

  const toggleTheme = () => {
    const next = !dark();
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <div class="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <header class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-lg font-semibold">Sankey Chart</h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Phase 7.6 — flow diagram. The last chart, and the structural outlier.
          </p>
        </div>
        <div class="flex shrink-0 gap-2">
          <Button variant="outline" onClick={toggleTheme}>
            {dark() ? "Light" : "Dark"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setRenderer((r) => (r === "canvas" ? "svg" : "canvas"))}
          >
            {renderer()}
          </Button>
          <Button variant="outline" onClick={() => setLoading((l) => !l)}>
            {loading() ? "Loaded" : "Loading"}
          </Button>
        </div>
      </header>

      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-medium">Intro cascade</h2>
            <p class="text-muted-foreground text-xs">
              Nodes pop open column by column; each band then draws out of its source. The
              layout never moves — the reveal is a windowed alpha on each element's own
              paint.
            </p>
          </div>
          <Button variant="outline" onClick={() => setReplay((n) => n + 1)}>
            Replay
          </Button>
        </div>
        <div class="border-border h-80 rounded-lg border p-2">
          {/* Remounting is what replays the cascade — the guard is per instance. */}
          <For each={[replay()]}>
            {() => (
              <EChartsSankeyChart
                data={DATA}
                config={CONFIG}
                renderer={renderer()}
                isLoading={loading()}
                class="h-full w-full"
              >
                <EChartsSankeyChart.Node radius={2} isClickable />
                <EChartsSankeyChart.NodeLabel position="outside" showValues />
                <EChartsSankeyChart.Tooltip />
              </EChartsSankeyChart>
            )}
          </For>
        </div>
      </section>

      <Demo
        title="Click to trace a flow"
        note="Selecting a node keeps it and its direct neighbours lit; bands recede further than nodes do."
      >
        <EChartsSankeyChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          animation={false}
          class="h-full w-full"
        >
          <EChartsSankeyChart.Node radius={2} isClickable>
            <EChartsSankeyChart.NodeLabel position="outside" showValues />
          </EChartsSankeyChart.Node>
          <EChartsSankeyChart.Tooltip />
        </EChartsSankeyChart>
      </Demo>

      <Demo
        title="Inside labels"
        note="The node becomes a card: a translucent plate over a coloured duplicate, with its own colour left as the rim."
      >
        <EChartsSankeyChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          animation={false}
          nodeWidth={64}
          class="h-full w-full"
        >
          <EChartsSankeyChart.Node radius={6}>
            <EChartsSankeyChart.NodeLabel position="inside" showValues />
          </EChartsSankeyChart.Node>
          <EChartsSankeyChart.Tooltip />
        </EChartsSankeyChart>
      </Demo>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium">Link variants</h2>
        <p class="text-muted-foreground text-xs">
          How each band is coloured between its two nodes.
        </p>
        <div class="grid grid-cols-2 gap-4">
          <For each={LINK_VARIANTS}>
            {(variant) => (
              <div class="border-border h-56 rounded-lg border p-2">
                <p class="text-muted-foreground px-1 font-mono text-[10px]">{variant}</p>
                <EChartsSankeyChart
                  data={DATA}
                  config={CONFIG}
                  renderer={renderer()}
                  animation={false}
                  class="h-[calc(100%-1rem)] w-full"
                >
                  <EChartsSankeyChart.Node radius={2} />
                  <EChartsSankeyChart.Link variant={variant} />
                  <EChartsSankeyChart.Tooltip />
                </EChartsSankeyChart>
              </div>
            )}
          </For>
        </div>
      </section>

      <Demo title="Straight bands" note="linkCurvature 0 squares off every flow.">
        <EChartsSankeyChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          animation={false}
          linkCurvature={0}
          nodeWidth={16}
          class="h-full w-full"
        >
          <EChartsSankeyChart.Node radius={2}>
            <EChartsSankeyChart.NodeLabel position="outside" />
          </EChartsSankeyChart.Node>
          <EChartsSankeyChart.Tooltip />
        </EChartsSankeyChart>
      </Demo>

      <Demo
        title="Left-aligned columns"
        note="align='left' packs nodes toward their earliest possible column instead of justifying."
      >
        <EChartsSankeyChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          animation={false}
          align="left"
          class="h-full w-full"
        >
          <EChartsSankeyChart.Node radius={2}>
            <EChartsSankeyChart.NodeLabel position="outside" />
          </EChartsSankeyChart.Node>
          <EChartsSankeyChart.Tooltip />
        </EChartsSankeyChart>
      </Demo>
    </div>
  );
}
