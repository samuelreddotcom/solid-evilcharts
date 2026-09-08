import { createFileRoute } from "@tanstack/solid-router";
import { For, createSignal, type JSX } from "solid-js";

import { EChartsRadarChart } from "../charts/radar-chart";
import type { ChartConfig, EChartsRenderer, GridType } from "../charts/radar-chart";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/radar-chart")({
  component: RadarChartDemo,
});

const DATA = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
  { month: "April", desktop: 273, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "June", desktop: 214, mobile: 140 },
];

const CONFIG: ChartConfig = {
  desktop: { label: "Desktop", colors: { light: ["#047857"], dark: ["#10b981"] } },
  mobile: { label: "Mobile", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
};

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

function RadarChartDemo() {
  const [dark, setDark] = createSignal(false);
  const [renderer, setRenderer] = createSignal<EChartsRenderer>("canvas");
  const [loading, setLoading] = createSignal(false);
  const [gridType, setGridType] = createSignal<GridType>("polygon");

  const toggleTheme = () => {
    const next = !dark();
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <div class="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <header class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-lg font-semibold">Radar Chart</h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Phase 7.5 — one polygon per series, on ECharts' dedicated radar coordinate
            system.
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

      <Demo title="Basic" note="Grid, perimeter labels, tooltip, legend.">
        <EChartsRadarChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          isLoading={loading()}
          class="h-full w-full"
        >
          <EChartsRadarChart.PolarGrid />
          <EChartsRadarChart.PolarAngleAxis dataKey="month" />
          <EChartsRadarChart.Tooltip />
          <EChartsRadarChart.Legend isClickable />
          <EChartsRadarChart.Radar dataKey="desktop" isClickable>
            <EChartsRadarChart.Dot variant="default" />
          </EChartsRadarChart.Radar>
          <EChartsRadarChart.Radar dataKey="mobile" isClickable>
            <EChartsRadarChart.Dot variant="default" />
          </EChartsRadarChart.Radar>
        </EChartsRadarChart>
      </Demo>

      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-medium">Grid shape</h2>
            <p class="text-muted-foreground text-xs">
              One `&lt;PolarGrid&gt;` drives both the spokes and the rings.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => setGridType((g) => (g === "polygon" ? "circle" : "polygon"))}
          >
            {gridType()}
          </Button>
        </div>
        <div class="border-border h-80 rounded-lg border p-2">
          <EChartsRadarChart
            data={DATA}
            config={CONFIG}
            renderer={renderer()}
            class="h-full w-full"
          >
            <EChartsRadarChart.PolarGrid gridType={gridType()} />
            <EChartsRadarChart.PolarAngleAxis dataKey="month" />
            <EChartsRadarChart.PolarRadiusAxis />
            <EChartsRadarChart.Tooltip />
            <EChartsRadarChart.Radar dataKey="desktop" />
          </EChartsRadarChart>
        </div>
      </section>

      <Demo title="Lines only" note="variant='lines' drops the fill entirely.">
        <EChartsRadarChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
        >
          <EChartsRadarChart.PolarGrid />
          <EChartsRadarChart.PolarAngleAxis dataKey="month" />
          <EChartsRadarChart.Tooltip />
          <EChartsRadarChart.Legend />
          <EChartsRadarChart.Radar dataKey="desktop" variant="lines">
            <EChartsRadarChart.Dot variant="border" />
          </EChartsRadarChart.Radar>
          <EChartsRadarChart.Radar dataKey="mobile" variant="lines">
            <EChartsRadarChart.Dot variant="border" />
          </EChartsRadarChart.Radar>
        </EChartsRadarChart>
      </Demo>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium">Fill opacity</h2>
        <p class="text-muted-foreground text-xs">
          Multiplies the radial centre→rim gradient, which is already brighter in the
          middle.
        </p>
        <div class="grid grid-cols-2 gap-4">
          <For each={[0.15, 0.3, 0.5, 0.8]}>
            {(fillOpacity) => (
              <div class="border-border h-56 rounded-lg border p-2">
                <p class="text-muted-foreground px-1 font-mono text-[10px]">
                  fillOpacity {fillOpacity}
                </p>
                <EChartsRadarChart
                  data={DATA}
                  config={CONFIG}
                  renderer={renderer()}
                  class="h-[calc(100%-1rem)] w-full"
                >
                  <EChartsRadarChart.PolarGrid />
                  <EChartsRadarChart.Radar dataKey="desktop" fillOpacity={fillOpacity} />
                </EChartsRadarChart>
              </div>
            )}
          </For>
        </div>
      </section>

      <Demo
        title="Active dots"
        note="ECharts radar has no per-state symbol size, so hover swaps dot STYLE at the resting size."
      >
        <EChartsRadarChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
        >
          <EChartsRadarChart.PolarGrid />
          <EChartsRadarChart.PolarAngleAxis dataKey="month" />
          <EChartsRadarChart.Tooltip />
          <EChartsRadarChart.Radar dataKey="desktop">
            <EChartsRadarChart.Dot variant="colored-border" />
            <EChartsRadarChart.ActiveDot variant="default" />
          </EChartsRadarChart.Radar>
        </EChartsRadarChart>
      </Demo>

      <Demo
        title="With the radial scale"
        note="<PolarRadiusAxis> shows the value ticks running outward. The 0 at dead centre is suppressed."
      >
        <EChartsRadarChart
          data={DATA}
          config={CONFIG}
          renderer={renderer()}
          class="h-full w-full"
        >
          <EChartsRadarChart.PolarGrid gridType="circle" />
          <EChartsRadarChart.PolarAngleAxis dataKey="month" />
          <EChartsRadarChart.PolarRadiusAxis />
          <EChartsRadarChart.Tooltip />
          <EChartsRadarChart.Legend />
          <EChartsRadarChart.Radar dataKey="desktop" fillOpacity={0.2} />
          <EChartsRadarChart.Radar dataKey="mobile" fillOpacity={0.2} />
        </EChartsRadarChart>
      </Demo>
    </div>
  );
}
