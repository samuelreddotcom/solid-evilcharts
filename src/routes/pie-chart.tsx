import { createFileRoute } from "@tanstack/solid-router";
import { For, createSignal, type JSX } from "solid-js";

import { EChartsPieChart } from "../charts/pie-chart";
import type { BackgroundVariant, ChartConfig, EChartsRenderer } from "../charts/pie-chart";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/pie-chart")({
  component: PieChartDemo,
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

const BACKGROUNDS: BackgroundVariant[] = [
  "dots",
  "grid",
  "cross-hatch",
  "diagonal-lines",
  "plus",
  "falling-triangles",
  "4-pointed-star",
  "tiny-checkers",
  "overlapping-circles",
  "wiggle-lines",
  "bubbles",
];

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

function PieChartDemo() {
  const [dark, setDark] = createSignal(false);
  const [renderer, setRenderer] = createSignal<EChartsRenderer>("canvas");
  const [loading, setLoading] = createSignal(false);
  const [selected, setSelected] = createSignal<string | null>(null);

  const toggleTheme = () => {
    const next = !dark();
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <div class="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <header class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-lg font-semibold">Pie Chart</h1>
          <p class="text-muted-foreground mt-1 text-sm">
            Phase 7.3 — the first non-cartesian chart. Sector geometry, an SVG background
            layer, and an angular shimmer.
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

      <Demo title="Basic" note="Click a sector to pop it out; the rest dim.">
        <EChartsPieChart
          data={DATA}
          config={CONFIG}
          dataKey="visitors"
          nameKey="browser"
          renderer={renderer()}
          isLoading={loading()}
          class="h-full w-full"
        >
          <EChartsPieChart.Tooltip />
          <EChartsPieChart.Legend isClickable />
          <EChartsPieChart.Pie isClickable />
        </EChartsPieChart>
      </Demo>

      <Demo
        title="Donut with a padding gap"
        note="A POSITIVE paddingAngle is a constant-width border, not an angular pad — the gap stays parallel-edged from rim to centre."
      >
        <EChartsPieChart
          data={DATA}
          config={CONFIG}
          dataKey="visitors"
          nameKey="browser"
          renderer={renderer()}
          class="h-full w-full"
        >
          <EChartsPieChart.Tooltip />
          <EChartsPieChart.Legend />
          <EChartsPieChart.Pie innerRadius="55%" cornerRadius={4} paddingAngle={3} />
        </EChartsPieChart>
      </Demo>

      <Demo
        title="Overlapping petals"
        note="A NEGATIVE paddingAngle overlaps the sectors and separates them with a wide background border."
      >
        <EChartsPieChart
          data={DATA}
          config={CONFIG}
          dataKey="visitors"
          nameKey="browser"
          renderer={renderer()}
          class="h-full w-full"
        >
          <EChartsPieChart.Tooltip />
          <EChartsPieChart.Pie paddingAngle={-8} cornerRadius={6} />
        </EChartsPieChart>
      </Demo>

      <Demo title="Inside labels" note="Value text on each sector, in background colour.">
        <EChartsPieChart
          data={DATA}
          config={CONFIG}
          dataKey="visitors"
          nameKey="browser"
          renderer={renderer()}
          class="h-full w-full"
        >
          <EChartsPieChart.Tooltip />
          <EChartsPieChart.Pie>
            <EChartsPieChart.Label position="inside" />
          </EChartsPieChart.Pie>
        </EChartsPieChart>
      </Demo>

      <Demo title="Outside labels" note="Sector names past the rim, with leader lines.">
        <EChartsPieChart
          data={DATA}
          config={CONFIG}
          dataKey="visitors"
          nameKey="browser"
          renderer={renderer()}
          class="h-full w-full"
        >
          <EChartsPieChart.Tooltip />
          <EChartsPieChart.Pie outerRadius="65%">
            <EChartsPieChart.Label position="outside" />
          </EChartsPieChart.Pie>
        </EChartsPieChart>
      </Demo>

      <Demo title="Half pie" note="startAngle / endAngle carve out any arc.">
        <EChartsPieChart
          data={DATA}
          config={CONFIG}
          dataKey="visitors"
          nameKey="browser"
          renderer={renderer()}
          class="h-full w-full"
        >
          <EChartsPieChart.Tooltip />
          <EChartsPieChart.Legend />
          <EChartsPieChart.Pie startAngle={180} endAngle={0} innerRadius="45%" />
        </EChartsPieChart>
      </Demo>

      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-medium">Controlled selection</h2>
            <p class="text-muted-foreground text-xs">
              onSelectionChange reports the sector name AND its value.
            </p>
          </div>
          <div class="flex gap-2">
            <For each={[null, "chrome", "safari"] as const}>
              {(key) => (
                <Button
                  variant={selected() === key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelected(key)}
                >
                  {key ?? "none"}
                </Button>
              )}
            </For>
          </div>
        </div>
        <div class="border-border h-72 rounded-lg border p-2">
          <EChartsPieChart
            data={DATA}
            config={CONFIG}
            dataKey="visitors"
            nameKey="browser"
            renderer={renderer()}
            class="h-full w-full"
            selectedSector={selected()}
          >
            <EChartsPieChart.Tooltip />
            <EChartsPieChart.Legend isClickable />
            <EChartsPieChart.Pie isClickable innerRadius="50%" />
          </EChartsPieChart>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium">Background patterns</h2>
        <p class="text-muted-foreground text-xs">
          SVG drawn behind the transparent canvas, blur-masked so it fades at the edges.
        </p>
        <div class="grid grid-cols-2 gap-4">
          <For each={BACKGROUNDS}>
            {(variant) => (
              <div class="border-border h-44 rounded-lg border p-2">
                <p class="text-muted-foreground px-1 font-mono text-[10px]">{variant}</p>
                <EChartsPieChart
                  data={DATA}
                  config={CONFIG}
                  dataKey="visitors"
                  nameKey="browser"
                  renderer={renderer()}
                  class="h-[calc(100%-1rem)] w-full"
                >
                  <EChartsPieChart.Background variant={variant} />
                  <EChartsPieChart.Pie innerRadius="45%" outerRadius="75%" />
                </EChartsPieChart>
              </div>
            )}
          </For>
        </div>
      </section>
    </div>
  );
}
