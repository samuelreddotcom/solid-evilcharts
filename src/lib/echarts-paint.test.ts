import { describe, expect, it } from "vitest";
import * as echarts from "echarts/core";

import { FALLBACK_SERIES_COLOR } from "./chart-tokens";
import {
  DEFAULT_ECHARTS_RENDERER,
  ECHARTS_RENDERERS,
  seriesPaint,
} from "./echarts-paint";

describe("seriesPaint", () => {
  it("returns a plain string for a single colour", () => {
    expect(seriesPaint(["rgba(1, 2, 3, 1)"])).toBe("rgba(1, 2, 3, 1)");
  });

  it("falls back to grey for an empty slot list", () => {
    expect(seriesPaint([])).toBe(FALLBACK_SERIES_COLOR);
  });

  it("builds a horizontal LinearGradient for multiple colours", () => {
    const paint = seriesPaint(["#a", "#b", "#c"]);

    expect(paint).toBeInstanceOf(echarts.graphic.LinearGradient);
    const gradient = paint as echarts.graphic.LinearGradient;
    // 0,0 → 1,0 is left-to-right.
    expect([gradient.x, gradient.y, gradient.x2, gradient.y2]).toEqual([0, 0, 1, 0]);
  });

  it("spreads stops evenly from 0 to 1", () => {
    const gradient = seriesPaint(["#a", "#b", "#c"]) as echarts.graphic.LinearGradient;
    expect(gradient.colorStops).toEqual([
      { offset: 0, color: "#a" },
      { offset: 0.5, color: "#b" },
      { offset: 1, color: "#c" },
    ]);
  });

  it("puts the last stop at exactly 1 for two colours", () => {
    const gradient = seriesPaint(["#a", "#b"]) as echarts.graphic.LinearGradient;
    expect(gradient.colorStops).toEqual([
      { offset: 0, color: "#a" },
      { offset: 1, color: "#b" },
    ]);
  });
});

describe("renderers", () => {
  it("exposes canvas and svg", () => {
    expect(ECHARTS_RENDERERS).toEqual({ canvas: "canvas", svg: "svg" });
  });

  it("defaults to canvas, matching upstream", () => {
    expect(DEFAULT_ECHARTS_RENDERER).toBe("canvas");
  });

  it("registers both renderers on import", () => {
    // echarts.use() is idempotent, so the observable effect is simply that
    // importing this module doesn't throw and init() can pick either renderer.
    const host = document.createElement("div");
    Object.defineProperty(host, "clientWidth", { value: 300 });
    Object.defineProperty(host, "clientHeight", { value: 200 });
    document.body.appendChild(host);

    const chart = echarts.init(host, undefined, { renderer: "svg" });
    expect(chart).toBeTruthy();
    chart.dispose();
    host.remove();
  });
});
