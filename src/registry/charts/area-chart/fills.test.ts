import { describe, expect, it } from "vitest";
import * as echarts from "echarts/core";

import { fillPaint, gradientFillTexture, patternFadeTexture, patternFill } from "./fills";

const GREEN = "rgba(0, 170, 0, 1)";
const SIZE = { width: 400, height: 300 };

/**
 * vitest.setup.ts stubs HTMLCanvasElement.getContext to return null, because
 * jsdom ships no canvas. Every texture path therefore takes its documented
 * fallback here. That is the behaviour worth pinning: a chart in a
 * canvas-less environment must still produce a valid ECharts colour rather
 * than undefined. The textures themselves can only be checked in a browser.
 */
describe("texture builders degrade without a 2D context", () => {
  it("patternFill returns null", () => {
    for (const kind of ["dotted", "lines", "hatched", "stripe"] as const) {
      expect(patternFill(kind, GREEN)).toBeNull();
    }
  });

  it("gradientFillTexture returns null", () => {
    expect(gradientFillTexture([GREEN, "#00f"], 400, 300, false)).toBeNull();
  });

  it("patternFadeTexture returns null", () => {
    expect(patternFadeTexture("dotted", GREEN, 400, 300)).toBeNull();
  });

  it("rejects a zero-sized plot before touching the canvas", () => {
    expect(gradientFillTexture([GREEN], 0, 300, false)).toBeNull();
    expect(gradientFillTexture([GREEN], 400, 0, false)).toBeNull();
  });
});

describe("fillPaint", () => {
  it("returns transparent for the none variant, even when unselected", () => {
    expect(fillPaint("none", false, [GREEN], SIZE)).toBe("transparent");
    expect(fillPaint("none", true, [GREEN], SIZE)).toBe("transparent");
  });

  it("fades a single-colour gradient downward", () => {
    const paint = fillPaint("gradient", false, [GREEN], SIZE);
    expect(paint).toBeInstanceOf(echarts.graphic.LinearGradient);
    const g = paint as echarts.graphic.LinearGradient;
    // 0,0 → 0,1 is top-to-bottom.
    expect([g.x, g.y, g.x2, g.y2]).toEqual([0, 0, 0, 1]);
    expect(g.colorStops[0]!.color).toBe("rgba(0, 170, 0, 0.100)");
    expect(g.colorStops[1]!.color).toBe("rgba(0, 170, 0, 0.000)");
  });

  it("flips the ramp for gradient-reverse", () => {
    const g = fillPaint("gradient-reverse", false, [GREEN], SIZE) as
      echarts.graphic.LinearGradient;
    expect(g.colorStops[0]!.color).toBe("rgba(0, 170, 0, 0.000)");
    expect(g.colorStops[1]!.color).toBe("rgba(0, 170, 0, 0.100)");
  });

  it("uses a flat alpha for a single-colour solid fill", () => {
    expect(fillPaint("solid", false, [GREEN], SIZE)).toBe("rgba(0, 170, 0, 0.100)");
  });

  it("keeps the horizontal colour run for a multi-colour solid fill", () => {
    const paint = fillPaint("solid", false, [GREEN, "rgba(0, 0, 255, 1)"], SIZE);
    expect(paint).toBeInstanceOf(echarts.graphic.LinearGradient);
    const g = paint as echarts.graphic.LinearGradient;
    // 0,0 → 1,0 is left-to-right: uniform alpha, varying hue.
    expect([g.x, g.y, g.x2, g.y2]).toEqual([0, 0, 1, 0]);
    expect(g.colorStops.map((s) => s.offset)).toEqual([0, 1]);
    expect(g.colorStops.every((s) => s.color.endsWith("0.100)"))).toBe(true);
  });

  it("falls back to a flat alpha for pattern variants without a canvas", () => {
    for (const variant of ["dotted", "lines", "hatched"] as const) {
      expect(fillPaint(variant, false, [GREEN], SIZE)).toBe("rgba(0, 170, 0, 0.100)");
    }
  });

  it("falls back to a flat alpha for the unselected stripe without a canvas", () => {
    expect(fillPaint("gradient", true, [GREEN], SIZE)).toBe("rgba(0, 170, 0, 0.100)");
  });

  it("recedes an unselected area regardless of its declared variant", () => {
    // Every variant but "none" takes the stripe path when unselected.
    for (const variant of ["gradient", "solid", "dotted", "hatched"] as const) {
      expect(fillPaint(variant, true, [GREEN], SIZE)).toBe("rgba(0, 170, 0, 0.100)");
    }
  });

  it("falls back to grey when a series has no colour slots", () => {
    expect(fillPaint("solid", false, [], SIZE)).toBe("rgba(120, 120, 120, 0.100)");
  });
});
