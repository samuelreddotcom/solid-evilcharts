import { describe, expect, it } from "vitest";

import { CHART_PREVIEWS } from "./chart-previews";
import { CHART_LINKS } from "../lib/nav";

/**
 * The landing page renders a preview for whichever chart is selected, looked up
 * by route. A nav entry with no preview renders an empty box on the one page
 * whose job is to show the charts — and it fails silently, because `Dynamic`
 * with an undefined component renders nothing rather than throwing.
 */
describe("chart previews", () => {
  it("covers every chart in the nav", () => {
    const missing = CHART_LINKS.filter((chart) => !CHART_PREVIEWS[chart.to]);

    expect(missing.map((c) => c.to)).toEqual([]);
  });

  it("has no preview for a route the nav dropped", () => {
    const routes = new Set(CHART_LINKS.map((c) => c.to));
    const orphans = Object.keys(CHART_PREVIEWS).filter((to) => !routes.has(to));

    expect(orphans).toEqual([]);
  });

  it("found charts to check at all", () => {
    // Both assertions above pass vacuously against an empty nav.
    expect(CHART_LINKS.length).toBe(8);
  });
});
