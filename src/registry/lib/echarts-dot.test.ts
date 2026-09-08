import { describe, expect, it } from "vitest";
import * as echarts from "echarts/core";

import { FALLBACK_SERIES_COLOR } from "./chart-tokens";
import {
  DOT_SIZES,
  dotItemStyle,
  dotStyle,
  sampleGradient,
  type DotVariant,
} from "./echarts-dot";

const PAINT = "rgba(0, 128, 0, 1)";
const BG = "rgba(255, 255, 255, 1)";

describe("dotItemStyle", () => {
  it("border: series-coloured core, background halo", () => {
    expect(dotItemStyle("border", PAINT, BG)).toEqual({
      color: PAINT,
      borderColor: BG,
      borderWidth: 2,
    });
  });

  it("colored-border: background core, thin coloured ring", () => {
    expect(dotItemStyle("colored-border", PAINT, BG)).toEqual({
      color: BG,
      borderColor: PAINT,
      borderWidth: 1,
    });
  });

  it("default: solid fill, no border", () => {
    expect(dotItemStyle("default", PAINT, BG)).toEqual({
      color: PAINT,
      borderWidth: 0,
    });
  });

  it("none: empty style", () => {
    expect(dotItemStyle("none", PAINT, BG)).toEqual({});
  });

  describe("ping", () => {
    it("REPLACES the paint's alpha with a flat 0.28 for the halo", () => {
      // Not withAlpha() from chart-tokens, which multiplies. The halo wants a
      // flat 28% regardless of the paint's incoming alpha.
      const style = dotItemStyle("ping", "rgba(0, 128, 0, 0.5)", BG);
      expect(style.borderColor).toBe("rgba(0, 128, 0, 0.28)");
      expect(style.borderWidth).toBe(10);
    });

    it("understands 6-digit hex", () => {
      expect(dotItemStyle("ping", "#0080ff", BG).borderColor).toBe(
        "rgba(0, 128, 255, 0.28)",
      );
    });

    it("expands 3-digit hex", () => {
      expect(dotItemStyle("ping", "#08f", BG).borderColor).toBe(
        "rgba(0, 136, 255, 0.28)",
      );
    });

    it("passes a named colour through untouched", () => {
      expect(dotItemStyle("ping", "rebeccapurple", BG).borderColor).toBe(
        "rebeccapurple",
      );
    });

    it("uses the gradient itself as the halo when the paint is a gradient", () => {
      const gradient = new echarts.graphic.LinearGradient(0, 0, 1, 0, [
        { offset: 0, color: "#a" },
        { offset: 1, color: "#b" },
      ]);
      const style = dotItemStyle("ping", gradient, BG);
      expect(style.borderColor).toBe(gradient);
    });
  });
});

describe("DOT_SIZES", () => {
  it("keeps the hover ring from reading smaller than a haloed resting dot", () => {
    // Flattening these to one size inverts the Recharts relationship.
    expect(DOT_SIZES.border).toBeGreaterThan(DOT_SIZES.default);
    expect(DOT_SIZES.none).toBe(0);
  });

  it("covers every variant", () => {
    const variants: DotVariant[] = [
      "none",
      "default",
      "border",
      "colored-border",
      "ping",
    ];
    for (const variant of variants) {
      expect(typeof DOT_SIZES[variant]).toBe("number");
    }
  });
});

describe("dotStyle", () => {
  it("pairs the size with the item style", () => {
    expect(dotStyle("border", PAINT, BG)).toEqual({
      size: 8,
      itemStyle: { color: PAINT, borderColor: BG, borderWidth: 2 },
    });
  });
});

describe("sampleGradient", () => {
  it("returns the only colour when there is one", () => {
    expect(sampleGradient(["rgba(1, 2, 3, 1)"], 0.5)).toBe("rgba(1, 2, 3, 1)");
  });

  it("falls back to grey for an empty slot list", () => {
    expect(sampleGradient([], 0.5)).toBe(FALLBACK_SERIES_COLOR);
  });

  it("hits the endpoints exactly", () => {
    const slots = ["rgba(0, 0, 0, 1)", "rgba(255, 255, 255, 1)"];
    expect(sampleGradient(slots, 0)).toBe("rgba(0, 0, 0, 1.000)");
    expect(sampleGradient(slots, 1)).toBe("rgba(255, 255, 255, 1.000)");
  });

  it("interpolates linearly at the midpoint", () => {
    const slots = ["rgba(0, 0, 0, 1)", "rgba(255, 255, 255, 1)"];
    expect(sampleGradient(slots, 0.5)).toBe("rgba(128, 128, 128, 1.000)");
  });

  it("interpolates within the correct segment of a 3-stop gradient", () => {
    const slots = ["rgba(0, 0, 0, 1)", "rgba(100, 100, 100, 1)", "rgba(200, 200, 200, 1)"];
    // t=0.25 is halfway through the first segment.
    expect(sampleGradient(slots, 0.25)).toBe("rgba(50, 50, 50, 1.000)");
    // t=0.75 is halfway through the second.
    expect(sampleGradient(slots, 0.75)).toBe("rgba(150, 150, 150, 1.000)");
  });

  it("interpolates alpha as well as colour", () => {
    const slots = ["rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 1)"];
    expect(sampleGradient(slots, 0.5)).toBe("rgba(0, 0, 0, 0.500)");
  });

  it("clamps the segment index at t = 1 rather than reading past the end", () => {
    const slots = ["rgba(0, 0, 0, 1)", "rgba(10, 10, 10, 1)", "rgba(20, 20, 20, 1)"];
    expect(sampleGradient(slots, 1)).toBe("rgba(20, 20, 20, 1.000)");
  });
});
