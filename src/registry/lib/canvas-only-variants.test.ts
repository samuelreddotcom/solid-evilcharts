import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { CANVAS_ONLY_AREA_VARIANTS } from "../charts/area-chart/types";
import { CANVAS_ONLY_BAR_VARIANTS } from "../charts/bar-chart/types";
import { CANVAS_ONLY_BAR_VARIANTS as CANVAS_ONLY_COMPOSED_VARIANTS } from "../charts/composed-chart/types";

/**
 * The CANVAS_ONLY_* lists drive a user-facing warning, so a stale list is worse
 * than no list: miss a variant and the silent failure is back, add a wrong one
 * and the warning cries wolf and gets muted.
 *
 * They cannot be checked by CALLING the paint functions — those need a real 2D
 * context and are no-ops under jsdom (vitest.setup.ts returns null from
 * getContext), so every variant would look like a fallback. So the lists are
 * extracted from the paint source instead, the same way boundary.test.ts reads
 * the registry rather than trusting a hand-kept copy.
 */

/**
 * Case labels in a switch whose branch body builds a canvas pattern, following
 * fallthrough — `case "dotted": case "lines": case "hatched": { … }` attributes
 * the shared body to all three.
 */
function canvasOnlyCasesIn(source: string): string[] {
  const found: string[] = [];
  let pending: string[] = [];

  for (const line of source.split("\n")) {
    const label = /^\s*case "([a-z-]+)":/.exec(line);
    if (label) {
      pending.push(label[1]!);
      // A body on the same line (`case "x": return patternFill(…)`) closes it.
      if (/pattern(Fill|FadeTexture)|barHatchPattern/.test(line)) {
        found.push(...pending);
        pending = [];
      }
      continue;
    }
    if (!pending.length) continue;
    if (/pattern(Fill|FadeTexture)|barHatchPattern/.test(line)) {
      found.push(...pending);
      pending = [];
      continue;
    }
    // Comments and blank lines are not statements — a pattern branch may well
    // open with one, and treating them as a reset loses the whole group.
    if (/^\s*(\/\/|\/\*|\*|$)/.test(line)) continue;
    // Any other statement means this body is not a pattern branch.
    if (/^\s{4,8}(return|const|let|if)\b/.test(line)) pending = [];
  }

  return [...new Set(found)].sort();
}

const read = (p: string) => readFileSync(resolve(import.meta.dirname, p), "utf8");

describe("canvas-only variant lists match the paint source", () => {
  it("area", () => {
    expect([...CANVAS_ONLY_AREA_VARIANTS].sort()).toEqual(
      canvasOnlyCasesIn(read("../charts/area-chart/fills.ts")),
    );
  });

  it("bar", () => {
    expect([...CANVAS_ONLY_BAR_VARIANTS].sort()).toEqual(
      canvasOnlyCasesIn(read("../charts/bar-chart/paints.ts")),
    );
  });

  it("composed", () => {
    expect([...CANVAS_ONLY_COMPOSED_VARIANTS].sort()).toEqual(
      canvasOnlyCasesIn(read("../charts/composed-chart/paints.ts")),
    );
  });

  it("the extractor actually finds something", () => {
    // Every assertion above passes vacuously if the regex stops matching.
    expect(canvasOnlyCasesIn(read("../charts/area-chart/fills.ts")).length).toBeGreaterThan(0);
  });
});
