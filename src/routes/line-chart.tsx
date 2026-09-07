import { createFileRoute } from "@tanstack/solid-router";
import { For, createSignal, type JSX } from "solid-js";

import { EChartsLineChart } from "../charts/line-chart";
import type { ChartConfig, EChartsRenderer } from "../charts/line-chart";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/line-chart")({
  component: LineChartDemo,
});

const DATA = [
  { month: "January", desktop: 342, mobile: 245 },
  { month: "February", desktop: 876, mobile: 654 },
  { month: "March", desktop: 512, mobile: 387 },
  { month: "April", desktop: 629, mobile: 521 },
  { month: "May", desktop: 458, mobile: 412 },
  { month: "June", desktop: 781, mobile: 598 },
  { month: "July", desktop: 394, mobile: 312 },
  { month: "August", desktop: 925, mobile: 743 },
  { month: "September", desktop: 647, mobile: 489 },
  { month: "October", desktop: 532, mobile: 476 },
  { month: "November", desktop: 803, mobile: 687 },
  { month: "December", desktop: 271, mobile: 198 },
];

const CONFIG: ChartConfig = {
  desktop: { label: "Desktop", colors: { light: ["#047857"], dark: ["#10b981"] } },
  mobile: { label: "Mobile", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
};

/** A two-stop gradient series, to exercise sampleGradient and seriesPaint. */
const GRADIENT_CONFIG: ChartConfig = {
  desktop: {
    label: "Desktop",
    colors: { light: ["#047857", "#0ea5e9"], dark: ["#10b981", "#38bdf8"] },
  },
};

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

function LineChartDemo() {
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
          <h1 class="text-lg font-semibold">Line Chart</h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Phase 5 — the first chart. Ported from EvilCharts, running on Apache ECharts.
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
        <EChartsLineChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          isLoading={loading()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsLineChart.Grid />
          <EChartsLineChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsLineChart.YAxis />
          <EChartsLineChart.Tooltip />
          <EChartsLineChart.Legend isClickable />
          <EChartsLineChart.Line dataKey="desktop" isClickable>
            <EChartsLineChart.Dot variant="border" />
            <EChartsLineChart.ActiveDot variant="colored-border" />
          </EChartsLineChart.Line>
          <EChartsLineChart.Line dataKey="mobile" isClickable>
            <EChartsLineChart.Dot variant="border" />
            <EChartsLineChart.ActiveDot variant="colored-border" />
          </EChartsLineChart.Line>
        </EChartsLineChart>
      </Demo>

      <Demo
        title="Gradient stroke"
        note="Two colour stops per series — the stroke and each dot sample the gradient at their own x."
      >
        <EChartsLineChart
          data={DATA}
          config={GRADIENT_CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsLineChart.Grid />
          <EChartsLineChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsLineChart.Tooltip />
          <EChartsLineChart.Line dataKey="desktop">
            <EChartsLineChart.Dot variant="default" />
          </EChartsLineChart.Line>
        </EChartsLineChart>
      </Demo>

      <Demo title="Brush" note="Drag the footer strip to zoom. Hover it for range labels.">
        <EChartsLineChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsLineChart.Grid />
          <EChartsLineChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsLineChart.Tooltip />
          <EChartsLineChart.Brush formatLabel={(v) => String(v).slice(0, 3)} />
          <EChartsLineChart.Line dataKey="desktop" />
          <EChartsLineChart.Line dataKey="mobile" />
        </EChartsLineChart>
      </Demo>

      <Demo
        title="Buffer line"
        note="The last segment dashes, as a forecast tail. Body stays solid."
      >
        <EChartsLineChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsLineChart.Grid />
          <EChartsLineChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsLineChart.Tooltip />
          <EChartsLineChart.Line dataKey="desktop" enableBufferLine>
            <EChartsLineChart.Dot variant="border" />
          </EChartsLineChart.Line>
        </EChartsLineChart>
      </Demo>

      <Demo title="Glowing" note="Stacked shadowBlur copies beneath the real stroke.">
        <EChartsLineChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsLineChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsLineChart.Tooltip />
          <EChartsLineChart.Line dataKey="desktop" glowing curveType="smooth">
            <EChartsLineChart.Dot variant="default" />
          </EChartsLineChart.Line>
        </EChartsLineChart>
      </Demo>

      <Demo
        title="Hover highlight"
        note="Hovering one series blurs the others — ECharts-native focus."
      >
        <EChartsLineChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
          enableHoverHighlight
        >
          <EChartsLineChart.Grid />
          <EChartsLineChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsLineChart.Tooltip />
          <EChartsLineChart.Legend />
          <EChartsLineChart.Line dataKey="desktop" />
          <EChartsLineChart.Line dataKey="mobile" />
        </EChartsLineChart>
      </Demo>

      <Demo
        title="Hover reveal"
        note="Each line is coloured up to the pointer and muted grey past it."
      >
        <EChartsLineChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
          enableHoverReveal
        >
          <EChartsLineChart.Grid />
          <EChartsLineChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsLineChart.Tooltip />
          <EChartsLineChart.Line dataKey="desktop" />
          <EChartsLineChart.Line dataKey="mobile" />
        </EChartsLineChart>
      </Demo>

      <Demo title="Animated dashed stroke" note="rAF sweeps the dash offset.">
        <EChartsLineChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
          xDataKey="month"
        >
          <EChartsLineChart.Grid />
          <EChartsLineChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <EChartsLineChart.Tooltip />
          <EChartsLineChart.Line dataKey="desktop" strokeVariant="animated-dashed" />
        </EChartsLineChart>
      </Demo>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium">Curve types</h2>
        <div class="grid grid-cols-2 gap-4">
          <For each={["linear", "smooth", "step"] as const}>
            {(curve) => (
              <div class="border-border h-40 rounded-lg border p-2">
                <p class="text-muted-foreground px-1 font-mono text-[10px]">{curve}</p>
                <EChartsLineChart
                  data={DATA}
                  config={CONFIG}
                  renderer={renderer()}
                  class="h-[calc(100%-1rem)] w-full"
                  xDataKey="month"
                  curveType={curve}
                >
                  <EChartsLineChart.Line dataKey="desktop">
                    <EChartsLineChart.Dot variant="default" />
                  </EChartsLineChart.Line>
                </EChartsLineChart>
              </div>
            )}
          </For>
        </div>
      </section>
    </div>
  );
}
