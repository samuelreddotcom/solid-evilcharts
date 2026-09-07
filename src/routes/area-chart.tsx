import { createFileRoute } from "@tanstack/solid-router";
import { For, createSignal, type JSX } from "solid-js";

import { EChartsAreaChart } from "../charts/area-chart";
import type { AreaVariant, ChartConfig, EChartsRenderer, StackType } from "../charts/area-chart";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/area-chart")({
  component: AreaChartDemo,
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
  { month: "September", desktop: 647, mobile: 489, tablet: 180 },
  { month: "October", desktop: 532, mobile: 476, tablet: 170 },
  { month: "November", desktop: 803, mobile: 687, tablet: 240 },
  { month: "December", desktop: 271, mobile: 198, tablet: 100 },
];

const CONFIG: ChartConfig = {
  desktop: { label: "Desktop", colors: { light: ["#047857"], dark: ["#10b981"] } },
  mobile: { label: "Mobile", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
  tablet: { label: "Tablet", colors: { light: ["#7c3aed"], dark: ["#a78bfa"] } },
};

const GRADIENT_CONFIG: ChartConfig = {
  desktop: {
    label: "Desktop",
    colors: { light: ["#047857", "#0ea5e9"], dark: ["#10b981", "#38bdf8"] },
  },
};

const VARIANTS: AreaVariant[] = [
  "gradient",
  "gradient-reverse",
  "solid",
  "dotted",
  "lines",
  "hatched",
  "none",
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

function AreaChartDemo() {
  const [dark, setDark] = createSignal(false);
  const [renderer, setRenderer] = createSignal<EChartsRenderer>("canvas");
  const [loading, setLoading] = createSignal(false);
  const [stackType, setStackType] = createSignal<StackType>("stacked");
  const [controlled, setControlled] = createSignal<string | null>(null);

  const toggleTheme = () => {
    const next = !dark();
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const cycleStack = () =>
    setStackType((s) =>
      s === "default" ? "stacked" : s === "stacked" ? "expanded" : "default",
    );

  return (
    <div class="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <header class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-lg font-semibold">Area Chart</h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Phase 6 — fills, stacking, controlled selection.
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

      <Demo title="Basic" note="Grid, axes, tooltip, legend, dots.">
        <EChartsAreaChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          isLoading={loading()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsAreaChart.Grid />
          <EChartsAreaChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsAreaChart.YAxis />
          <EChartsAreaChart.Tooltip />
          <EChartsAreaChart.Legend isClickable />
          <EChartsAreaChart.Area dataKey="desktop" isClickable>
            <EChartsAreaChart.Dot variant="border" />
            <EChartsAreaChart.ActiveDot variant="colored-border" />
          </EChartsAreaChart.Area>
          <EChartsAreaChart.Area dataKey="mobile" isClickable>
            <EChartsAreaChart.Dot variant="border" />
            <EChartsAreaChart.ActiveDot variant="colored-border" />
          </EChartsAreaChart.Area>
        </EChartsAreaChart>
      </Demo>

      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-medium">Stacking</h2>
            <p class="text-muted-foreground text-xs">
              default → stacked → expanded (100%). Click to cycle.
            </p>
          </div>
          <Button variant="outline" onClick={cycleStack}>
            {stackType()}
          </Button>
        </div>
        <div class="border-border h-64 rounded-lg border p-2">
          <EChartsAreaChart
            data={DATA}
            config={CONFIG}
            renderer={renderer()}
            class="h-full w-full"
            xDataKey="month"
            stackType={stackType()}
          >
            <EChartsAreaChart.Grid />
            <EChartsAreaChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
            <EChartsAreaChart.Tooltip />
            <EChartsAreaChart.Legend />
            <EChartsAreaChart.Area dataKey="desktop" variant="solid" />
            <EChartsAreaChart.Area dataKey="mobile" variant="solid" />
            <EChartsAreaChart.Area dataKey="tablet" variant="solid" />
          </EChartsAreaChart>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium">Fill variants</h2>
        <p class="text-muted-foreground text-xs">
          The three pattern fills bake a tiling canvas texture, then mask it with a
          vertical alpha ramp.
        </p>
        <div class="grid grid-cols-2 gap-4">
          <For each={VARIANTS}>
            {(variant) => (
              <div class="border-border h-40 rounded-lg border p-2">
                <p class="text-muted-foreground px-1 font-mono text-[10px]">{variant}</p>
                <EChartsAreaChart
                  data={DATA}
                  config={CONFIG}
                  renderer={renderer()}
                  class="h-[calc(100%-1rem)] w-full"
                  xDataKey="month"
                >
                  <EChartsAreaChart.Area dataKey="desktop" variant={variant} />
                </EChartsAreaChart>
              </div>
            )}
          </For>
        </div>
      </section>

      <Demo
        title="Gradient fill, two colour stops"
        note="Composites a horizontal colour run with a vertical alpha fade on an offscreen canvas."
      >
        <EChartsAreaChart
          data={DATA}
          config={GRADIENT_CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsAreaChart.Grid />
          <EChartsAreaChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsAreaChart.Tooltip />
          <EChartsAreaChart.Area dataKey="desktop">
            <EChartsAreaChart.Dot variant="default" />
          </EChartsAreaChart.Area>
        </EChartsAreaChart>
      </Demo>

      <Demo title="Brush" note="Drag the footer strip to zoom. The mini chart is filled too.">
        <EChartsAreaChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
          stackType="stacked"
        >
          <EChartsAreaChart.Grid />
          <EChartsAreaChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsAreaChart.Tooltip />
          <EChartsAreaChart.Brush formatLabel={(v) => String(v).slice(0, 3)} />
          <EChartsAreaChart.Area dataKey="desktop" variant="solid" />
          <EChartsAreaChart.Area dataKey="mobile" variant="solid" />
        </EChartsAreaChart>
      </Demo>

      <Demo
        title="Buffer area"
        note="The last segment dashes with no fill; a fill-only patch keeps the body solid beneath it."
      >
        <EChartsAreaChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsAreaChart.Grid />
          <EChartsAreaChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsAreaChart.Tooltip />
          <EChartsAreaChart.Area dataKey="desktop" enableBufferLine>
            <EChartsAreaChart.Dot variant="border" />
          </EChartsAreaChart.Area>
        </EChartsAreaChart>
      </Demo>

      <Demo
        title="Hover highlight"
        note="Pointer-driven, not series-driven — overlapping polygons are resolved geometrically."
      >
        <EChartsAreaChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
          stackType="stacked"
          enableHoverHighlight
        >
          <EChartsAreaChart.Grid />
          <EChartsAreaChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsAreaChart.Tooltip />
          <EChartsAreaChart.Legend />
          <EChartsAreaChart.Area dataKey="desktop" variant="solid" />
          <EChartsAreaChart.Area dataKey="mobile" variant="solid" />
          <EChartsAreaChart.Area dataKey="tablet" variant="solid" />
        </EChartsAreaChart>
      </Demo>

      <Demo title="Hover reveal" note="Coloured up to the pointer, muted grey past it.">
        <EChartsAreaChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
          enableHoverReveal
        >
          <EChartsAreaChart.Grid />
          <EChartsAreaChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsAreaChart.Tooltip />
          <EChartsAreaChart.Area dataKey="desktop" />
          <EChartsAreaChart.Area dataKey="mobile" />
        </EChartsAreaChart>
      </Demo>

      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-medium">Controlled selection</h2>
            <p class="text-muted-foreground text-xs">
              The chart renders whatever the parent says — legend clicks only report.
            </p>
          </div>
          <div class="flex gap-2">
            <For each={[null, "desktop", "mobile"] as const}>
              {(key) => (
                <Button
                  variant={controlled() === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setControlled(key)}
                >
                  {key ?? "none"}
                </Button>
              )}
            </For>
          </div>
        </div>
        <div class="border-border h-64 rounded-lg border p-2">
          <EChartsAreaChart
            data={DATA}
            config={CONFIG}
            renderer={renderer()}
            class="h-full w-full"
            xDataKey="month"
            selectedDataKey={controlled()}
          >
            <EChartsAreaChart.Grid />
            <EChartsAreaChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
            <EChartsAreaChart.Tooltip />
            <EChartsAreaChart.Legend isClickable />
            <EChartsAreaChart.Area dataKey="desktop" isClickable />
            <EChartsAreaChart.Area dataKey="mobile" isClickable />
          </EChartsAreaChart>
        </div>
      </section>
    </div>
  );
}
