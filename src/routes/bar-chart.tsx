import { createFileRoute } from "@tanstack/solid-router";
import { For, createSignal, type JSX } from "solid-js";

import { EChartsBarChart } from "../registry/charts/bar-chart";
import type {
  BarLayout,
  BarVariant,
  ChartConfig,
  EChartsRenderer,
  StackType,
} from "../registry/charts/bar-chart";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/bar-chart")({
  component: BarChartDemo,
});

const DATA = [
  { month: "January", desktop: 342, mobile: 245, tablet: 120 },
  { month: "February", desktop: 876, mobile: 654, tablet: 210 },
  { month: "March", desktop: 512, mobile: 387, tablet: 160 },
  { month: "April", desktop: 629, mobile: 521, tablet: 190 },
  { month: "May", desktop: 458, mobile: 412, tablet: 140 },
  { month: "June", desktop: 781, mobile: 598, tablet: 230 },
  { month: "July", desktop: 394, mobile: 312, tablet: 130 },
  { month: "August", desktop: 925, mobile: 743, tablet: 260 },
];

const CONFIG: ChartConfig = {
  desktop: { label: "Desktop", colors: { light: ["#047857"], dark: ["#10b981"] } },
  mobile: { label: "Mobile", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
  tablet: { label: "Tablet", colors: { light: ["#7c3aed"], dark: ["#a78bfa"] } },
};

const VARIANTS: BarVariant[] = [
  "default",
  "gradient",
  "duotone",
  "duotone-reverse",
  "hatched",
  "stripped",
  "blocks",
  "expandable",
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

function BarChartDemo() {
  const [dark, setDark] = createSignal(false);
  const [renderer, setRenderer] = createSignal<EChartsRenderer>("canvas");
  const [loading, setLoading] = createSignal(false);
  const [layout, setLayout] = createSignal<BarLayout>("vertical");
  const [stackType, setStackType] = createSignal<StackType>("stacked");

  const toggleTheme = () => {
    const next = !dark();
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const cycleStack = () =>
    setStackType((s) => (s === "default" ? "stacked" : s === "stacked" ? "percent" : "default"));

  return (
    <div class="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <header class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-lg font-semibold">Bar Chart</h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Phase 7 — eight fill variants, layout swap, post-layout measurement.
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

      <Demo title="Basic" note="Grid, axes, tooltip, legend.">
        <EChartsBarChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          isLoading={loading()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsBarChart.Grid />
          <EChartsBarChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsBarChart.YAxis />
          <EChartsBarChart.Tooltip />
          <EChartsBarChart.Legend isClickable />
          <EChartsBarChart.Bar dataKey="desktop" isClickable />
          <EChartsBarChart.Bar dataKey="mobile" isClickable />
        </EChartsBarChart>
      </Demo>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium">Fill variants</h2>
        <p class="text-muted-foreground text-xs">
          `stripped` keeps a constant-pixel cap by deriving a per-bar gradient fraction
          from the measured axis scale. `blocks` sizes its squares from the measured bar
          width. `expandable` is a hairline until hovered.
        </p>
        <div class="grid grid-cols-2 gap-4">
          <For each={VARIANTS}>
            {(variant) => (
              <div class="border-border h-40 rounded-lg border p-2">
                <p class="text-muted-foreground px-1 font-mono text-[10px]">{variant}</p>
                <EChartsBarChart
                  data={DATA}
                  config={CONFIG}
                  renderer={renderer()}
                  class="h-[calc(100%-1rem)] w-full"
                  xDataKey="month"
                >
                  <EChartsBarChart.Bar dataKey="desktop" variant={variant} />
                </EChartsBarChart>
              </div>
            )}
          </For>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-medium">Layout</h2>
            <p class="text-muted-foreground text-xs">
              Swaps the category and value axes; the category axis inverts on y to match
              Recharts.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setLayout((l) => (l === "vertical" ? "horizontal" : "vertical"))}
          >
            {layout()}
          </Button>
        </div>
        <div class="border-border h-72 rounded-lg border p-2">
          <EChartsBarChart
            data={DATA}
            config={CONFIG}
            renderer={renderer()}
            class="h-full w-full"
            xDataKey="month"
            layout={layout()}
          >
            <EChartsBarChart.Grid />
            <EChartsBarChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
            <EChartsBarChart.YAxis />
            <EChartsBarChart.Tooltip />
            <EChartsBarChart.Bar dataKey="desktop" />
          </EChartsBarChart>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-medium">Stacking</h2>
            <p class="text-muted-foreground text-xs">
              Segments are parted by a real transparent spacer series, sized from the axis
              scale.
            </p>
          </div>
          <Button variant="outline" onClick={cycleStack}>
            {stackType()}
          </Button>
        </div>
        <div class="border-border h-64 rounded-lg border p-2">
          <EChartsBarChart
            data={DATA}
            config={CONFIG}
            renderer={renderer()}
            class="h-full w-full"
            xDataKey="month"
            stackType={stackType()}
          >
            <EChartsBarChart.Grid />
            <EChartsBarChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
            <EChartsBarChart.YAxis />
            <EChartsBarChart.Tooltip />
            <EChartsBarChart.Legend />
            <EChartsBarChart.Bar dataKey="desktop" />
            <EChartsBarChart.Bar dataKey="mobile" />
            <EChartsBarChart.Bar dataKey="tablet" />
          </EChartsBarChart>
        </div>
      </section>

      <Demo
        title="Max value highlight"
        note="Colours only the tallest COLUMN — totals across every series — and haloes it."
      >
        <EChartsBarChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
          enableMaxValueHighlight
        >
          <EChartsBarChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsBarChart.Tooltip />
          <EChartsBarChart.Bar dataKey="desktop" />
        </EChartsBarChart>
      </Demo>

      <Demo title="Glowing" note="Per-bar sampled shadowColor, so a gradient glows in its own colours.">
        <EChartsBarChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsBarChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsBarChart.Tooltip />
          <EChartsBarChart.Bar dataKey="desktop" glowing />
        </EChartsBarChart>
      </Demo>

      <Demo title="Buffer bar" note="The last datum becomes a hatched, outlined projection.">
        <EChartsBarChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsBarChart.Grid />
          <EChartsBarChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsBarChart.Tooltip />
          <EChartsBarChart.Bar dataKey="desktop" bufferBar />
        </EChartsBarChart>
      </Demo>

      <Demo title="Hover highlight" note="ECharts-native focus:self — the hovered bar stays lit.">
        <EChartsBarChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsBarChart.Grid />
          <EChartsBarChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsBarChart.Tooltip />
          <EChartsBarChart.Bar dataKey="desktop" enableHoverHighlight />
        </EChartsBarChart>
      </Demo>

      <Demo title="Brush" note="Drag the footer strip to zoom.">
        <EChartsBarChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsBarChart.Grid />
          <EChartsBarChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsBarChart.Tooltip />
          <EChartsBarChart.Brush formatLabel={(v) => String(v).slice(0, 3)} />
          <EChartsBarChart.Bar dataKey="desktop" />
        </EChartsBarChart>
      </Demo>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium">Grow-in order</h2>
        <p class="text-muted-foreground text-xs">
          Bars are independent rectangles, so each direction is a per-datum animationDelay.
          Reload to replay.
        </p>
        <div class="grid grid-cols-2 gap-4">
          <For each={["left-to-right", "right-to-left", "center-out", "edges-in"] as const}>
            {(animationType) => (
              <div class="border-border h-40 rounded-lg border p-2">
                <p class="text-muted-foreground px-1 font-mono text-[10px]">{animationType}</p>
                <EChartsBarChart
                  data={DATA}
                  config={CONFIG}
                  renderer={renderer()}
                  class="h-[calc(100%-1rem)] w-full"
                  xDataKey="month"
                  animationType={animationType}
                >
                  <EChartsBarChart.Bar dataKey="desktop" />
                </EChartsBarChart>
              </div>
            )}
          </For>
        </div>
      </section>
    </div>
  );
}
