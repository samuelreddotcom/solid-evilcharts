import { createFileRoute } from "@tanstack/solid-router";
import { For, createSignal, type JSX } from "solid-js";

import { EChartsRadialChart } from "../charts/radial-chart";
import type { ChartConfig, EChartsRenderer } from "../charts/radial-chart";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/radial-chart")({
  component: RadialChartDemo,
});

const DATA = [
  { browser: "chrome", visitors: 275 },
  { browser: "safari", visitors: 200 },
  { browser: "firefox", visitors: 187 },
  { browser: "edge", visitors: 173 },
  { browser: "other", visitors: 90 },
];

const CONFIG: ChartConfig = {
  chrome: { label: "Chrome", colors: { light: ["#047857"], dark: ["#10b981"] } },
  safari: { label: "Safari", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
  firefox: { label: "Firefox", colors: { light: ["#7c3aed"], dark: ["#a78bfa"] } },
  edge: { label: "Edge", colors: { light: ["#0369a1"], dark: ["#38bdf8"] } },
  other: { label: "Other", colors: { light: ["#a16207"], dark: ["#fbbf24"] } },
};

const GAUGE_DATA = [{ metric: "score", value: 72 }];
const GAUGE_CONFIG: ChartConfig = {
  score: { label: "Score", colors: { light: ["#047857"], dark: ["#10b981"] } },
};

function Demo(props: { title: string; note?: string; children: JSX.Element }) {
  return (
    <section class="flex flex-col gap-2">
      <div>
        <h2 class="text-sm font-medium">{props.title}</h2>
        {props.note && <p class="text-muted-foreground text-xs">{props.note}</p>}
      </div>
      <div class="border-border h-72 rounded-lg border p-2">{props.children}</div>
    </section>
  );
}

function RadialChartDemo() {
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
          <h1 class="text-lg font-semibold">Radial Chart</h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Phase 7.4 — polar bars. One ring per row, on a real angle/radius axis pair.
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

      <Demo title="Basic" note="One ring per row, with the unfilled track behind each.">
        <EChartsRadialChart
          data={DATA}
          config={CONFIG}
          nameKey="browser"
          renderer={renderer()}
          isLoading={loading()}
          class="h-full w-full"
        >
          <EChartsRadialChart.Tooltip />
          <EChartsRadialChart.Legend isClickable />
          <EChartsRadialChart.RadialBar dataKey="visitors" showBackground isClickable />
        </EChartsRadialChart>
      </Demo>

      <Demo
        title="Semi arc"
        note="A half circle rests on its diameter, so the centre drops to 70% to keep it visually centred."
      >
        <EChartsRadialChart
          data={DATA}
          config={CONFIG}
          nameKey="browser"
          renderer={renderer()}
          variant="semi"
          class="h-full w-full"
        >
          <EChartsRadialChart.Tooltip />
          <EChartsRadialChart.RadialBar dataKey="visitors" showBackground />
        </EChartsRadialChart>
      </Demo>

      <Demo
        title="Gauge"
        note="An explicit max pins what a full sweep means, so a single value reads against a fixed total."
      >
        <EChartsRadialChart
          data={GAUGE_DATA}
          config={GAUGE_CONFIG}
          nameKey="metric"
          renderer={renderer()}
          variant="semi"
          max={100}
          innerRadius="60%"
          class="h-full w-full"
        >
          <EChartsRadialChart.Tooltip />
          <EChartsRadialChart.RadialBar dataKey="value" barSize={28} showBackground />
        </EChartsRadialChart>
      </Demo>

      <Demo title="Thick rings, no track" note="barSize and cornerRadius shape each ring.">
        <EChartsRadialChart
          data={DATA}
          config={CONFIG}
          nameKey="browser"
          renderer={renderer()}
          innerRadius="20%"
          class="h-full w-full"
        >
          <EChartsRadialChart.Tooltip />
          <EChartsRadialChart.Legend />
          <EChartsRadialChart.RadialBar dataKey="visitors" barSize={20} cornerRadius={10} />
        </EChartsRadialChart>
      </Demo>

      <Demo title="Square caps" note="cornerRadius 0 turns off the rounded cap.">
        <EChartsRadialChart
          data={DATA}
          config={CONFIG}
          nameKey="browser"
          renderer={renderer()}
          class="h-full w-full"
        >
          <EChartsRadialChart.Tooltip />
          <EChartsRadialChart.RadialBar dataKey="visitors" cornerRadius={0} showBackground />
        </EChartsRadialChart>
      </Demo>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium">Background patterns</h2>
        <p class="text-muted-foreground text-xs">
          The same SVG layer the pie uses — shared from lib/, not duplicated. Here it is a
          root prop rather than a marker.
        </p>
        <div class="grid grid-cols-2 gap-4">
          <For each={["dots", "grid", "cross-hatch", "bubbles"] as const}>
            {(variant) => (
              <div class="border-border h-52 rounded-lg border p-2">
                <p class="text-muted-foreground px-1 font-mono text-[10px]">{variant}</p>
                <EChartsRadialChart
                  data={DATA}
                  config={CONFIG}
                  nameKey="browser"
                  renderer={renderer()}
                  backgroundVariant={variant}
                  class="h-[calc(100%-1rem)] w-full"
                >
                  <EChartsRadialChart.RadialBar dataKey="visitors" showBackground />
                </EChartsRadialChart>
              </div>
            )}
          </For>
        </div>
      </section>
    </div>
  );
}
