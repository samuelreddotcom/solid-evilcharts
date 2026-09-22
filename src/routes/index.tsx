import { Link, createFileRoute } from "@tanstack/solid-router";
import { For, Suspense, createSignal } from "solid-js";
import { Dynamic } from "solid-js/web";

import { CHART_PREVIEWS } from "../components/chart-previews";
import { CommandBlock } from "../components/docs/command-block";
import { CHART_LINKS } from "../lib/nav";
import { GITHUB_URL } from "../lib/site";

/** The page's one link treatment: a rule under the text, darkening on hover. */
const LINK = "underline decoration-border underline-offset-4 transition-colors";
const LINK_STRONG = `text-foreground hover:decoration-foreground ${LINK}`;
const LINK_MUTED = `text-muted-foreground hover:text-foreground ${LINK}`;

/**
 * The chart switcher's buttons. `aria-pressed` carries the selected state for
 * assistive tech AND drives the styling, so the two cannot drift apart.
 */
const TOGGLE =
  "text-muted-foreground hover:text-foreground aria-pressed:bg-muted " +
  "aria-pressed:text-foreground rounded-md px-2.5 py-1 text-sm transition-colors";

const CTA =
  "bg-primary text-primary-foreground hover:bg-primary/90 " +
  "rounded-md px-4 py-2 font-medium transition-colors";

export const Route = createFileRoute("/")({
  component: Home,
});

/**
 * The landing page.
 *
 * The one rule it is built on: this library's entire claim is that the charts
 * look good, so the first thing on the page is a chart, live. The previous
 * version listed the eight charts as text blurbs in bordered cards — a
 * description of a visual product, on the one page whose job is to show it.
 *
 * The chart names are the CONTROL for that preview rather than a grid of cards.
 * That is what lets the page show all eight without mounting all eight: the
 * switcher loads one chunk at a time (see chart-previews.ts).
 *
 * Colour policy: the page itself is greyscale — every token in styles.css is
 * zero-chroma — and the charts are the only colour on it. Nothing here
 * introduces an accent; if it is not data, it is not coloured.
 */
function Home() {
  const [selected, setSelected] = createSignal(CHART_LINKS[0]!);

  return (
    <main class="mx-auto max-w-3xl px-8 pt-14 pb-20">
      <h1 class="text-4xl font-semibold tracking-tight sm:text-5xl">Solid EvilCharts</h1>

      <p class="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed">
        Eight chart types for SolidJS, built on Apache ECharts. The CLI copies the source into your
        project, so the charts are yours to edit — there is no runtime package and no version to
        keep in step.
      </p>

      <div class="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <Link
          to="/docs/$"
          params={{ _splat: "introduction" }}
          class={CTA}
        >
          Read the docs
        </Link>
        <a
          href={GITHUB_URL}
          class={LINK_MUTED}
        >
          Source on GitHub
        </a>
      </div>

      {/*
        The preview. `min-h` is set to the tallest demo (sankey, h-96) so
        switching never reflows the page under the reader's cursor; the shorter
        demos sit in the slack rather than the box resizing around them.

        No Skeleton in the Suspense fallback — skeleton.tsx says so explicitly:
        charts draw their own clipped shimmer inside the canvas, and covering
        that with a grey block trades a good loading state for a worse one. An
        empty reserved box is the honest placeholder.
      */}
      <section class="mt-12" aria-labelledby="preview-heading">
        <h2 id="preview-heading" class="sr-only">
          Chart previews
        </h2>

        <div class="border-border bg-card flex min-h-96 items-center rounded-xl border p-4 sm:p-6">
          <Suspense fallback={<div class="h-72 w-full" />}>
            <Dynamic component={CHART_PREVIEWS[selected().to]} />
          </Suspense>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-1.5">
          <For each={CHART_LINKS}>
            {(chart) => (
              <button
                type="button"
                onClick={() => setSelected(chart)}
                aria-pressed={chart.to === selected().to}
                class={TOGGLE}
              >
                {chart.label}
              </button>
            )}
          </For>
        </div>

        <p class="text-muted-foreground mt-4 text-sm">
          {selected().blurb}{" "}
          <Link
            to={selected().to}
            class={LINK_STRONG}
          >
            Open the {selected().label.toLowerCase()} chart
          </Link>
        </p>
      </section>

      <section class="mt-16" aria-labelledby="install-heading">
        <h2 id="install-heading" class="text-lg font-medium">
          Install
        </h2>
        <p class="text-muted-foreground mt-2 text-sm leading-relaxed">
          Add ECharts, then add the chart you want. Every chart is a separate item, so you install
          the line chart without pulling in the other seven.
        </p>
        <CommandBlock registryItem="line-chart" />
        <p class="text-muted-foreground text-sm leading-relaxed">
          Do not run <code class="font-mono text-xs">shadcn init</code> — it is React-only and
          overwrites your <code class="font-mono text-xs">src/lib/utils.ts</code>. The{" "}
          <Link
            to="/docs/$"
            params={{ _splat: "installation" }}
            class={LINK_STRONG}
          >
            installation guide
          </Link>{" "}
          has the <code class="font-mono text-xs">components.json</code> to copy instead.
        </p>
      </section>

      <section class="mt-16" aria-labelledby="status-heading">
        <h2 id="status-heading" class="text-lg font-medium">
          Status
        </h2>
        <p class="text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed">
          Working, not yet 1.0. All eight charts are ported and installable and the docs are
          complete, but nothing is tagged yet and the API can still change — pin by reading the
          source you installed.
        </p>
      </section>

      <p class="text-muted-foreground mt-16 max-w-xl text-sm leading-relaxed">
        A SolidJS port of{" "}
        <a
          href="https://evilcharts.com"
          class={LINK_STRONG}
        >
          EvilCharts
        </a>{" "}
        by Gurbinder, used under the MIT licence. The chart designs, variants and component API
        originate there. If you write React, use the original.
      </p>
    </main>
  );
}
