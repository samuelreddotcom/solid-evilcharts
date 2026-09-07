import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/")({
  component: Home,
});

const PHASES = [
  { n: 0, name: "Spike the config-as-children pattern", done: true },
  { n: 1, name: "Repo scaffold", done: true },
  { n: 2, name: "Tokens + vendored UI primitives", done: false },
  { n: 3, name: "Engine-neutral core", done: false },
  { n: 4, name: "Shared primitives", done: false },
  { n: 5, name: "Line chart", done: false },
  { n: 6, name: "Area chart → ship 0.1.0", done: false },
];

function Home() {
  return (
    <main class="mx-auto max-w-2xl px-6 py-16">
      <h1 class="text-2xl font-semibold tracking-tight">@solid-foundation/charts</h1>
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

      <ul class="mt-10 space-y-2">
        {PHASES.map((phase) => (
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
            <span class="text-muted-foreground tabular-nums">
              Phase {phase.n}
            </span>
            <span class={phase.done ? "" : "text-muted-foreground"}>{phase.name}</span>
          </li>
        ))}
      </ul>

      <p class="text-muted-foreground mt-10 text-xs">
        Scaffold only. Charts land in Phase 5.
      </p>
    </main>
  );
}
