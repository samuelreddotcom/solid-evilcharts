import { describe, expect, it } from "vitest";
import * as echarts from "echarts/core";

import {
  barBorderRadius,
  barFillPaint,
  duotoneSplitPaint,
  expandableDatumPaint,
  patternFill,
  solidVerticalPaint,
  strippedCapFraction,
  strippedDatumPaint,
  verticalFadePaint,
} from "./paints";
import { STRIPPED_CAP_MAX_FRACTION, STRIPPED_FALLBACK_FRACTION } from "./types";

const GREEN = "rgba(0, 170, 0, 1)";
const BLUE = "rgba(0, 0, 255, 1)";

const asGradient = (paint: unknown) => paint as echarts.graphic.LinearGradient;

describe("solidVerticalPaint", () => {
  it("returns a bare string for one colour at full alpha", () => {
    expect(solidVerticalPaint([GREEN], 1)).toBe(GREEN);
  });

  it("applies alpha to a single colour", () => {
    expect(solidVerticalPaint([GREEN], 0.5)).toBe("rgba(0, 170, 0, 0.500)");
  });

  it("runs a multi-colour gradient TOP-TO-BOTTOM, unlike the area chart", () => {
    const g = asGradient(solidVerticalPaint([GREEN, BLUE], 1));
    expect([g.x, g.y, g.x2, g.y2]).toEqual([0, 0, 0, 1]);
    expect(g.colorStops.map((s) => s.offset)).toEqual([0, 1]);
  });

  it("falls back to grey with no slots", () => {
    expect(solidVerticalPaint([], 1)).toBe("rgba(120, 120, 120, 1)");
  });
});

describe("verticalFadePaint", () => {
  const g = asGradient(verticalFadePaint([GREEN]));

  it("holds full alpha through the top fifth", () => {
    expect(g.colorStops[0]!.color).toBe("rgba(0, 170, 0, 1.000)");
    expect(g.colorStops[1]!.color).toBe("rgba(0, 170, 0, 1.000)");
    expect(g.colorStops[1]!.offset).toBe(0.2);
  });

  it("reaches zero by 90%, matching the Recharts mask", () => {
    const at90 = g.colorStops.find((s) => s.offset === 0.9);
    expect(at90!.color).toBe("rgba(0, 170, 0, 0.000)");
  });

  it("runs top-to-bottom", () => {
    expect([g.x, g.y, g.x2, g.y2]).toEqual([0, 0, 0, 1]);
  });
});

describe("duotoneSplitPaint", () => {
  it("splits hard at 50% with coincident stops", () => {
    const g = asGradient(duotoneSplitPaint(GREEN, 0.4, 1, false));
    expect(g.colorStops.map((s) => s.offset)).toEqual([0, 0.5, 0.5, 1]);
    expect(g.colorStops[0]!.color).toBe("rgba(0, 170, 0, 0.400)");
    expect(g.colorStops[3]!.color).toBe("rgba(0, 170, 0, 1.000)");
  });

  it("splits across the CROSS axis for each layout", () => {
    // Vertical bars: split left↔right (x 1→0). Horizontal bars: top↔bottom.
    const vertical = asGradient(duotoneSplitPaint(GREEN, 0.4, 1, false));
    expect([vertical.x, vertical.y, vertical.x2, vertical.y2]).toEqual([1, 0, 0, 0]);

    const horizontal = asGradient(duotoneSplitPaint(GREEN, 0.4, 1, true));
    expect([horizontal.x, horizontal.y, horizontal.x2, horizontal.y2]).toEqual([0, 0, 0, 1]);
  });
});

describe("strippedCapFraction", () => {
  it("falls back before the axis has been measured", () => {
    expect(strippedCapFraction(100, null)).toBe(STRIPPED_FALLBACK_FRACTION);
  });

  it("falls back for a zero-height bar", () => {
    expect(strippedCapFraction(0, 2)).toBe(STRIPPED_FALLBACK_FRACTION);
  });

  it("shrinks the fraction as the bar grows, keeping a CONSTANT pixel cap", () => {
    // Cap height is 4px. At 2px per unit, a 100-unit bar is 200px → 4/200.
    expect(strippedCapFraction(100, 2)).toBeCloseTo(0.02);
    // Twice the bar, half the fraction — the pixel cap is unchanged.
    expect(strippedCapFraction(200, 2)).toBeCloseTo(0.01);
  });

  it("never swallows a very short bar", () => {
    expect(strippedCapFraction(1, 2)).toBe(STRIPPED_CAP_MAX_FRACTION);
  });
});

describe("strippedDatumPaint", () => {
  it("puts a hard-edged cap at the tip", () => {
    const g = asGradient(strippedDatumPaint([GREEN], false, 0.1));
    expect(g.colorStops.map((s) => s.offset)).toEqual([0, 0.1, 0.1, 1]);
    // Cap at full alpha, body dimmed to 0.2.
    expect(g.colorStops[0]!.color).toBe("rgba(0, 170, 0, 1.000)");
    expect(g.colorStops[2]!.color).toBe("rgba(0, 170, 0, 0.200)");
  });

  it("orients the tip per layout", () => {
    const vertical = asGradient(strippedDatumPaint([GREEN], false, 0.1));
    expect([vertical.x, vertical.y, vertical.x2, vertical.y2]).toEqual([0, 0, 0, 1]);
    const horizontal = asGradient(strippedDatumPaint([GREEN], true, 0.1));
    expect([horizontal.x, horizontal.y, horizontal.x2, horizontal.y2]).toEqual([1, 0, 0, 0]);
  });

  it("clamps an out-of-range fraction", () => {
    expect(asGradient(strippedDatumPaint([GREEN], false, 5)).colorStops[1]!.offset).toBe(1);
    expect(asGradient(strippedDatumPaint([GREEN], false, -1)).colorStops[1]!.offset).toBe(0);
  });
});

describe("expandableDatumPaint", () => {
  it("opens a centred strip with hard edges", () => {
    const g = asGradient(expandableDatumPaint([GREEN], 0.5));
    // half = 0.25 → strip runs 0.25 → 0.75.
    expect(g.colorStops.map((s) => s.offset)).toEqual([0, 0.25, 0.25, 0.75, 0.75, 1]);
    expect(g.colorStops[0]!.color).toBe("rgba(0, 170, 0, 0.000)");
    expect(g.colorStops[2]!.color).toBe(GREEN);
  });

  it("is symmetric about the middle at every openness", () => {
    for (const f of [0, 0.12, 0.5, 1]) {
      const g = asGradient(expandableDatumPaint([GREEN], f));
      const left = g.colorStops[1]!.offset;
      const right = g.colorStops[4]!.offset;
      expect(left + right).toBeCloseTo(1);
    }
  });

  it("fills the whole bar when fully open", () => {
    const g = asGradient(expandableDatumPaint([GREEN], 1));
    expect(g.colorStops[1]!.offset).toBe(0);
    expect(g.colorStops[4]!.offset).toBe(1);
  });

  it("runs horizontally — it is a width, not a height", () => {
    const g = asGradient(expandableDatumPaint([GREEN], 0.5));
    expect([g.x, g.y, g.x2, g.y2]).toEqual([0, 0, 1, 0]);
  });
});

describe("patternFill degrades without a 2D context", () => {
  it("returns null for every kind", () => {
    for (const kind of ["hatched", "buffer", "blocks"] as const) {
      expect(patternFill(kind, GREEN)).toBeNull();
    }
  });
});

describe("barFillPaint", () => {
  it("falls back to a solid paint for pattern variants without a canvas", () => {
    expect(barFillPaint("hatched", [GREEN], false)).toBe(GREEN);
    expect(barFillPaint("blocks", [GREEN], false)).toBe(GREEN);
  });

  it("returns a plain colour for the default variant", () => {
    expect(barFillPaint("default", [GREEN], false)).toBe(GREEN);
  });

  it("routes each gradient variant to its own paint", () => {
    expect(barFillPaint("gradient", [GREEN], false)).toBeInstanceOf(
      echarts.graphic.LinearGradient,
    );
    expect(barFillPaint("duotone", [GREEN], false)).toBeInstanceOf(
      echarts.graphic.LinearGradient,
    );
    expect(barFillPaint("stripped", [GREEN], false)).toBeInstanceOf(
      echarts.graphic.LinearGradient,
    );
    expect(barFillPaint("expandable", [GREEN], false)).toBeInstanceOf(
      echarts.graphic.LinearGradient,
    );
  });

  it("mirrors duotone-reverse's alphas", () => {
    const normal = asGradient(barFillPaint("duotone", [GREEN], false));
    const reversed = asGradient(barFillPaint("duotone-reverse", [GREEN], false));
    expect(normal.colorStops[0]!.color).toBe(reversed.colorStops[3]!.color);
    expect(normal.colorStops[3]!.color).toBe(reversed.colorStops[0]!.color);
  });
});

describe("barBorderRadius", () => {
  it("rounds every corner for ordinary variants", () => {
    expect(barBorderRadius(4, "default", false)).toBe(4);
    expect(barBorderRadius(4, "gradient", false)).toBe(4);
  });

  it("rounds only the TIP corners for stripped", () => {
    // ECharts corner order: [top-left, top-right, bottom-right, bottom-left].
    expect(barBorderRadius(4, "stripped", false)).toEqual([4, 4, 0, 0]);
    expect(barBorderRadius(4, "stripped", true)).toEqual([0, 4, 4, 0]);
  });

  it("drops the radius where it would destroy the variant", () => {
    // Blocks draw square segments; a radius clips the end one. An expandable bar
    // is a hairline at rest, which a radius would swallow.
    expect(barBorderRadius(4, "blocks", false)).toBe(0);
    expect(barBorderRadius(4, "expandable", false)).toBe(0);
  });
});
