import { Link, createFileRoute } from "@tanstack/solid-router";
import { For } from "solid-js";

import { CHART_LINKS } from "../components/site-nav";

export const Route = createFileRoute("/")({
  component: Home,
});

/** One line per chart, describing what its demo actually shows. */
const CHART_NOTES: Record<string, string> = {
  "/line-chart": "Strokes, dots, brush, buffer tail, glow, hover reveal.",
  "/area-chart": "Seven fills, stacking, 100% stacks, controlled selection.",
  "/bar-chart": "Eight fills, layout swap, post-layout measurement.",
  "/composed-chart": "Bars and lines together, with two glow strategies.",
  "/pie-chart": "Sector geometry, labels, 11 SVG background patterns.",
  "/radial-chart": "Polar bars, gauges, semi arcs, background tracks.",
  "/radar-chart": "One polygon per series, grid shapes, fill opacity.",
  "/sankey-chart": "Flow diagram with a column-by-column intro cascade.",
};

const PHASES = [
  { n: "0", name: "Config-as-children spike", done: true },
  { n: "1", name: "Repo scaffold", done: true },
  { n: "2", name: "Tokens + vendored UI primitives", done: true },
  { n: "3", name: "Engine-neutral core", done: true },
  { n: "4", name: "Shared primitives", done: true },
  { n: "5", name: "Line chart", done: true },
  { n: "6", name: "Area chart", done: true },
  { n: "7", name: "Remaining charts — all 8 ported", done: true },
  { n: "8", name: "Registry / distribution", done: false },
  { n: "9", name: "Docs site", done: false },
  { n: "10", name: "TanStack Charts as a second engine", done: false },
];

function Home() {
  return (
    <main class="mx-auto max-w-3xl px-8 py-12">
      <h1 class="text-2xl font-semibold tracking-tight">Solid EvilCharts</h1>
      <p class="text-muted-foreground mt-2 text-sm">
        Static, beautifully designed charts for SolidJS, powered by Apache ECharts.
      </p>
      <p class="text-muted-foreground mt-1 text-sm">
        A SolidJS port of{" "}
        <a class="underline underline-offset-4" href="https://evilcharts.com">
          EvilCharts
        </a>{" "}
        by Gurbinder, MIT.
      </p>

      <h2 class="mt-10 text-sm font-medium">Charts</h2>
      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        <For each={CHART_LINKS}>
          {(chart) => (
            <Link
              to={chart.to}
              class="border-border hover:bg-muted/50 flex flex-col gap-1 rounded-lg border p-3 transition-colors"
            >
              <span class="text-sm font-medium">{chart.label}</span>
              <span class="text-muted-foreground text-xs">{CHART_NOTES[chart.to]}</span>
            </Link>
          )}
        </For>
      </div>

      <h2 class="mt-10 text-sm font-medium">Also here</h2>
      <div class="mt-3">
        <Link
          to="/previews"
          class="border-border hover:bg-muted/50 flex flex-col gap-1 rounded-lg border p-3 transition-colors sm:w-1/2"
        >
          <span class="text-sm font-medium">UI previews</span>
          <span class="text-muted-foreground text-xs">
            The vendored design-system components, plus a live token probe.
          </span>
        </Link>
      </div>

      <h2 class="mt-10 text-sm font-medium">Progress</h2>
      <ul class="mt-3 space-y-1.5">
        <For each={PHASES}>
          {(phase) => (
            <li class="flex items-center gap-3 text-sm">
              <span
                class={
                  phase.done
                    ? "text-foreground w-4 shrink-0"
                    : "text-muted-foreground w-4 shrink-0"
                }
              >
                {phase.done ? "✓" : "·"}
              </span>
              <span class="text-muted-foreground w-16 shrink-0 tabular-nums">
                Phase {phase.n}
              </span>
              <span class={phase.done ? "" : "text-muted-foreground"}>{phase.name}</span>
            </li>
          )}
        </For>
      </ul>

      <p class="text-muted-foreground mt-10 text-xs">
        Pre-alpha. Nothing is published yet.
      </p>
    </main>
  );
}
