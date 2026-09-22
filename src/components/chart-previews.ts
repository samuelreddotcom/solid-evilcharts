import { lazy, type Component } from "solid-js";

/**
 * The eight chart demos, lazily imported, keyed by the route they document.
 *
 * Two decisions worth keeping:
 *
 * 1. These are the SAME components the docs pages render, not a second set
 *    written for the landing page. A landing page whose charts drift from the
 *    documented ones is worse than no landing page — it is a promise the docs
 *    then break. `chart-previews.test.ts` asserts the keys here match
 *    CHART_LINKS, so a ninth chart cannot be added to the nav without one.
 *
 * 2. `lazy()`, one chunk per chart. The whole point of the switcher is that a
 *    visitor loads the chart they asked to see and no others; eagerly importing
 *    all eight would pull every chart into the landing route's chunk and undo
 *    the code-splitting the docs index already fought for.
 *
 * Declared at module scope on purpose: a `lazy()` created inside a component
 * is a new component identity on every render, which remounts the chart and
 * replays its intro animation on unrelated state changes.
 */
const demo = (load: () => Promise<Record<string, Component>>, name: string) =>
  lazy(async () => ({ default: (await load())[name]! }));

export const CHART_PREVIEWS: Record<string, Component> = {
  "/line-chart": demo(() => import("~/content/docs/_demos/line-chart-demo"), "LineChartDemo"),
  "/area-chart": demo(() => import("~/content/docs/_demos/area-chart-demo"), "AreaChartDemo"),
  "/bar-chart": demo(() => import("~/content/docs/_demos/bar-chart-demo"), "BarChartDemo"),
  "/composed-chart": demo(
    () => import("~/content/docs/_demos/composed-chart-demo"),
    "ComposedChartDemo",
  ),
  "/pie-chart": demo(() => import("~/content/docs/_demos/pie-chart-demo"), "PieChartDemo"),
  "/radial-chart": demo(() => import("~/content/docs/_demos/radial-chart-demo"), "RadialChartDemo"),
  "/radar-chart": demo(() => import("~/content/docs/_demos/radar-chart-demo"), "RadarChartDemo"),
  "/sankey-chart": demo(() => import("~/content/docs/_demos/sankey-chart-demo"), "SankeyChartDemo"),
};
