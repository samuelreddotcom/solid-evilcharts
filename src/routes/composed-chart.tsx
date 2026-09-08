import { createFileRoute } from "@tanstack/solid-router";
import { For, createSignal, type JSX } from "solid-js";

import { EChartsComposedChart } from "../registry/charts/composed-chart";
import type { BarVariant, ChartConfig, EChartsRenderer } from "../registry/charts/composed-chart";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/composed-chart")({
  component: ComposedChartDemo,
});

const DATA = [
  { month: "January", revenue: 342, target: 400, forecast: 380 },
  { month: "February", revenue: 876, target: 700, forecast: 720 },
  { month: "March", revenue: 512, target: 550, forecast: 540 },
  { month: "April", revenue: 629, target: 600, forecast: 610 },
  { month: "May", revenue: 458, target: 500, forecast: 520 },
  { month: "June", revenue: 781, target: 720, forecast: 740 },
  { month: "July", revenue: 394, target: 450, forecast: 470 },
  { month: "August", revenue: 925, target: 800, forecast: 830 },
];

const CONFIG: ChartConfig = {
  revenue: { label: "Revenue", colors: { light: ["#047857"], dark: ["#10b981"] } },
  target: { label: "Target", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
  forecast: { label: "Forecast", colors: { light: ["#7c3aed"], dark: ["#a78bfa"] } },
};

const VARIANTS: BarVariant[] = [
  "default",
  "gradient",
  "duotone",
  "duotone-reverse",
  "hatched",
  "stripped",
];

function Demo(props: { title: string; note?: string; children: JSX.Element }) {
  return (
    <section class="flex flex-col gap-2">
      <div>
        <h2 class="text-sm font-medium">{props.title}</h2>
        {props.note && <p class="text-muted-foreground text-xs">{props.note}</p>}
      </div>
      <div class="border-border h-64 rounded-lg border p-2">{props.children}</div>
    </section>
  );
}

function ComposedChartDemo() {
  const [dark, setDark] = createSignal(false);
  const [renderer, setRenderer] = createSignal<EChartsRenderer>("canvas");
  const [loading, setLoading] = createSignal(false);

  const toggleTheme = () => {
    const next = !dark();
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <div class="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <header class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-lg font-semibold">Composed Chart</h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Phase 7.2 — bars and lines on one axis, with two different glow strategies.
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

      <Demo title="Basic" note="Bars behind, lines in front — matching the Recharts twin's JSX order.">
        <EChartsComposedChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          isLoading={loading()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsComposedChart.Grid />
          <EChartsComposedChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsComposedChart.YAxis />
          <EChartsComposedChart.Tooltip />
          <EChartsComposedChart.Legend isClickable />
          <EChartsComposedChart.Bar dataKey="revenue" isClickable />
          <EChartsComposedChart.Line dataKey="target" isClickable curveType="smooth">
            <EChartsComposedChart.Dot variant="border" />
            <EChartsComposedChart.ActiveDot variant="colored-border" />
          </EChartsComposedChart.Line>
        </EChartsComposedChart>
      </Demo>

      <Demo
        title="Two glow strategies"
        note="The bar gets a canvas shadow; the line gets stacked overlay copies, because one shadowColor can't follow a gradient."
      >
        <EChartsComposedChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsComposedChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsComposedChart.Tooltip />
          <EChartsComposedChart.Bar dataKey="revenue" glow />
          <EChartsComposedChart.Line dataKey="target" glow curveType="smooth" />
        </EChartsComposedChart>
      </Demo>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium">Bar variants</h2>
        <p class="text-muted-foreground text-xs">
          Six here, not the bar chart's eight — `blocks` and `expandable` both need
          post-layout measurement and are deliberately left out.
        </p>
        <div class="grid grid-cols-2 gap-4">
          <For each={VARIANTS}>
            {(variant) => (
              <div class="border-border h-40 rounded-lg border p-2">
                <p class="text-muted-foreground px-1 font-mono text-[10px]">{variant}</p>
                <EChartsComposedChart
                  data={DATA}
                  config={CONFIG}
                  renderer={renderer()}
                  class="h-[calc(100%-1rem)] w-full"
                  xDataKey="month"
                >
                  <EChartsComposedChart.Bar dataKey="revenue" variant={variant} />
                  <EChartsComposedChart.Line dataKey="target" />
                </EChartsComposedChart>
              </div>
            )}
          </For>
        </div>
      </section>

      <Demo title="Multiple bars and lines" note="Grouped columns with two overlaid lines.">
        <EChartsComposedChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsComposedChart.Grid />
          <EChartsComposedChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsComposedChart.Tooltip />
          <EChartsComposedChart.Legend />
          <EChartsComposedChart.Bar dataKey="revenue" variant="gradient" />
          <EChartsComposedChart.Bar dataKey="forecast" variant="hatched" />
          <EChartsComposedChart.Line dataKey="target" curveType="smooth" />
        </EChartsComposedChart>
      </Demo>

      <Demo title="Animated dashed line" note="rAF crawls the dash one full period per second.">
        <EChartsComposedChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsComposedChart.Grid />
          <EChartsComposedChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsComposedChart.Tooltip />
          <EChartsComposedChart.Bar dataKey="revenue" variant="duotone" />
          <EChartsComposedChart.Line dataKey="target" strokeVariant="animated-dashed" />
        </EChartsComposedChart>
      </Demo>

      <Demo
        title="Hover highlight"
        note="blurScope 'series' keeps the dim inside the bar — the line stays untouched."
      >
        <EChartsComposedChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsComposedChart.Grid />
          <EChartsComposedChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsComposedChart.Tooltip />
          <EChartsComposedChart.Bar dataKey="revenue" enableHoverHighlight />
          <EChartsComposedChart.Line dataKey="target" />
        </EChartsComposedChart>
      </Demo>

      <Demo title="Brush" note="Both kinds mirror into the mini chart as area-lines.">
        <EChartsComposedChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsComposedChart.Grid />
          <EChartsComposedChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsComposedChart.Tooltip />
          <EChartsComposedChart.Brush formatLabel={(v) => String(v).slice(0, 3)} />
          <EChartsComposedChart.Bar dataKey="revenue" />
          <EChartsComposedChart.Line dataKey="target" />
        </EChartsComposedChart>
      </Demo>
    </div>
  );
}
