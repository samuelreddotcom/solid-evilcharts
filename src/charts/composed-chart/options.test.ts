import { describe, expect, it } from "vitest";
import * as echarts from "echarts/core";

import type { ResolvedColors } from "../../lib/chart-tokens";
import "../../lib/echarts-paint";
import {
  buildBarSeries,
  buildBrushOption,
  buildLineGlowSeries,
  buildLineSeries,
  buildLoadingOption,
  buildChartLayout,
  buildMainAxes,
  createTooltipFormatter,
  seriesDim,
  seriesFillDim,
  seriesLabel,
  type OptionBuildContext,
} from "./options";
import { barFillPaint, verticalColorGradient } from "./paints";
import {
  LINE_GLOW_LAYERS,
  SELECTION_DIM,
  SELECTION_DIM_FILL,
  type BarSeriesConfig,
  type LineSeriesConfig,
} from "./types";

const TOKENS: ResolvedColors["tokens"] = {
  mutedForeground: "rgba(100, 100, 100, 1)",
  border: "rgba(200, 200, 200, 0.5)",
  foreground: "rgba(0, 0, 0, 1)",
  background: "rgba(255, 255, 255, 1)",
};

const DATA = [
  { month: "Jan", revenue: 10, target: 30 },
  { month: "Feb", revenue: 20, target: 20 },
  { month: "Mar", revenue: 30, target: 10 },
];

function bar(overrides: Partial<BarSeriesConfig> = {}): BarSeriesConfig {
  return {
    dataKey: "revenue",
    variant: "default",
    radius: 4,
    glow: false,
    isClickable: false,
    enableHoverHighlight: false,
    ...overrides,
  };
}

function line(overrides: Partial<LineSeriesConfig> = {}): LineSeriesConfig {
  return {
    dataKey: "target",
    strokeVariant: "solid",
    connectNulls: false,
    glow: false,
    isClickable: false,
    dotVariant: "none",
    activeDotVariant: "none",
    ...overrides,
  };
}

function ctx(overrides: Partial<OptionBuildContext> = {}): OptionBuildContext {
  return {
    data: DATA,
    config: {
      revenue: { label: "Revenue", colors: { light: ["#0a0"] } },
      target: { label: "Target", colors: { light: ["#a00"] } },
    },
    bars: [bar()],
    lines: [line()],
    seriesKeys: ["revenue", "target"],
    curveType: "linear",
    animationType: "left-to-right",
    selectedDataKey: null,
    showGrid: false,
    xAxisSlot: { present: false, hideDots: false },
    yAxisSlot: { present: false, hideDots: false },
    tooltipSlot: {
      present: false,
      variant: "default",
      roundness: "lg",
      cursor: true,
      position: "variable",
    },
    legendSlot: {
      present: false,
      variant: "rounded-square",
      align: "right",
      verticalAlign: "top",
      isClickable: false,
    },
    isLoading: false,
    loadingData: () => [1, 2, 3],
    loadingLineData: () => [4, 5, 6],
    showBrush: false,
    brushHeight: 56,
    resolved: {
      series: { revenue: ["rgba(0, 170, 0, 1)"], target: ["rgba(170, 0, 0, 1)"] },
      tokens: TOKENS,
    },
    categories: ["Jan", "Feb", "Mar"],
    brushRange: { start: 0, end: 100 },
    getHoveredKey: () => null,
    ...overrides,
  };
}

describe("selection dims", () => {
  it("dims strokes and fills by DIFFERENT amounts", () => {
    // A fill is denser than a stroke, so it has to recede further to read as
    // equally de-emphasised.
    expect(seriesDim("target", "revenue")).toBe(SELECTION_DIM);
    expect(seriesFillDim("target", "revenue")).toBe(SELECTION_DIM_FILL);
    expect(SELECTION_DIM_FILL).toBeLessThan(SELECTION_DIM);
  });

  it("leaves the selected series and the unselected state alone", () => {
    expect(seriesDim(null, "revenue")).toBe(1);
    expect(seriesFillDim("revenue", "revenue")).toBe(1);
  });
});

describe("seriesLabel", () => {
  it("prefers the config label, falling back to the key", () => {
    expect(seriesLabel({ a: { label: "Alpha" } }, "a")).toBe("Alpha");
    expect(seriesLabel({}, "a")).toBe("a");
  });
});

describe("layering", () => {
  it("puts bars at z 2 and lines at z 3, so strokes read above columns", () => {
    expect(buildBarSeries(ctx())[0]!.z).toBe(2);
    expect(buildLineSeries(ctx())[0]!.z).toBe(3);
  });

  it("puts line glow between them", () => {
    const glow = buildLineGlowSeries(ctx({ lines: [line({ glow: true })] }));
    expect(glow.every((s) => s.z === 2)).toBe(true);
  });
});

describe("the two glow strategies", () => {
  it("gives a single-colour BAR a plain canvas shadow", () => {
    const series = buildBarSeries(ctx({ bars: [bar({ glow: true })] }));
    expect(series[0]!.itemStyle?.shadowBlur).toBe(16);
    // No per-datum wrapping needed — one flat shadow suffices.
    expect(series[0]!.data).toEqual([10, 20, 30]);
  });

  it("samples a multi-colour BAR's shadow PER DATUM", () => {
    const series = buildBarSeries(
      ctx({
        bars: [bar({ glow: true })],
        resolved: {
          series: { revenue: ["rgba(0, 170, 0, 1)", "rgba(0, 0, 255, 1)"] },
          tokens: TOKENS,
        },
      }),
    );
    const data = series[0]!.data as { itemStyle: Record<string, unknown> }[];
    expect(data).toHaveLength(3);
    // Each column's halo follows the palette at its own x — one flat tint would
    // be wrong across a gradient.
    const colors = data.map((d) => d.itemStyle.shadowColor);
    expect(new Set(colors).size).toBe(3);
  });

  it("gives a LINE stacked overlay copies rather than a shadow", () => {
    // A single shadowColor can't follow a horizontal gradient, so lines get
    // silent copies instead.
    const main = buildLineSeries(ctx({ lines: [line({ glow: true })] }));
    expect(main[0]!.lineStyle?.shadowBlur).toBeUndefined();

    const glow = buildLineGlowSeries(ctx({ lines: [line({ glow: true })] }));
    expect(glow).toHaveLength(LINE_GLOW_LAYERS.length);
    expect(glow.every((s) => s.silent)).toBe(true);
  });

  it("orders glow copies widest-blur first so tighter layers paint on top", () => {
    const glow = buildLineGlowSeries(ctx({ lines: [line({ glow: true })] }));
    const blurs = glow.map((s) => s.lineStyle?.shadowBlur as number);
    expect(blurs).toEqual([...blurs].sort((a, b) => b - a));
  });

  it("emits no glow series for a non-glowing line", () => {
    expect(buildLineGlowSeries(ctx())).toEqual([]);
  });
});

describe("bar hover highlight", () => {
  it("scopes the blur to the series so lines are untouched", () => {
    const series = buildBarSeries(ctx({ bars: [bar({ enableHoverHighlight: true })] }));
    expect(series[0]!.emphasis).toEqual({ focus: "self", blurScope: "series" });
  });

  it("stands down while a selection owns the dim", () => {
    const series = buildBarSeries(
      ctx({ bars: [bar({ enableHoverHighlight: true })], selectedDataKey: "target" }),
    );
    expect(series[0]!.emphasis).toEqual({ focus: "none" });
    expect(series[0]!.blur).toBeUndefined();
  });
});

describe("escape hatches", () => {
  it("merges barProps over the built bar series", () => {
    const series = buildBarSeries(
      ctx({ bars: [bar({ barProps: { barWidth: 12, z: 99 } })] }),
    );
    expect(series[0]!.barWidth).toBe(12);
    expect(series[0]!.z).toBe(99);
  });

  it("merges lineProps over the built line series", () => {
    const series = buildLineSeries(ctx({ lines: [line({ lineProps: { symbol: "rect" } })] }));
    expect(series[0]!.symbol).toBe("rect");
  });
});

describe("stripped bars", () => {
  it("square off, since the bright strip lives inside the fill", () => {
    const series = buildBarSeries(ctx({ bars: [bar({ variant: "stripped" })] }));
    expect(series[0]!.itemStyle?.borderRadius).toBe(0);
  });

  it("keeps the radius for every other variant", () => {
    const series = buildBarSeries(ctx({ bars: [bar({ variant: "gradient" })] }));
    expect(series[0]!.itemStyle?.borderRadius).toBe(4);
  });
});

describe("barFillPaint", () => {
  it("returns a vertical run for the default variant", () => {
    expect(barFillPaint("default", ["rgba(0, 170, 0, 1)"])).toBe("rgba(0, 170, 0, 1)");
    expect(verticalColorGradient(["#a", "#b"])).toBeInstanceOf(
      echarts.graphic.LinearGradient,
    );
  });

  it("fades gradient bars to nothing by 90%", () => {
    const g = barFillPaint("gradient", ["rgba(0, 170, 0, 1)"]) as echarts.graphic.LinearGradient;
    expect(g.colorStops.map((s) => s.offset)).toEqual([0, 0.2, 0.9, 1]);
    expect(g.colorStops[2]!.color).toBe("rgba(0, 170, 0, 0.000)");
  });

  it("mirrors duotone-reverse", () => {
    const normal = barFillPaint("duotone", ["rgba(0, 170, 0, 1)"]) as echarts.graphic.LinearGradient;
    const reversed = barFillPaint(
      "duotone-reverse",
      ["rgba(0, 170, 0, 1)"],
    ) as echarts.graphic.LinearGradient;
    expect(normal.colorStops[0]!.color).toBe(reversed.colorStops[3]!.color);
  });

  it("puts the stripped bright edge in the top 5%", () => {
    const g = barFillPaint("stripped", ["rgba(0, 170, 0, 1)"]) as echarts.graphic.LinearGradient;
    expect(g.colorStops.map((s) => s.offset)).toEqual([0, 0.05, 1]);
    expect(g.colorStops[0]!.color).toBe("rgba(0, 170, 0, 1.000)");
  });

  it("falls back to the base colour for hatched without a canvas", () => {
    expect(barFillPaint("hatched", ["rgba(0, 170, 0, 1)"])).toBe("rgba(0, 170, 0, 1)");
  });
});

describe("brush", () => {
  it("mirrors BOTH bars and lines as area-lines", () => {
    const { miniSeries } = buildBrushOption(ctx({ showBrush: true }), 6);
    expect(miniSeries.map((s) => s.id)).toEqual(["__mini-revenue", "__mini-target"]);
    // Even the bar's mirror is a line — the mini chart is a shape summary.
    expect(miniSeries.every((s) => s.type === "line")).toBe(true);
    expect(miniSeries.every((s) => s.areaStyle !== undefined)).toBe(true);
  });

  it("dims stroke and fill by their respective amounts", () => {
    const { miniSeries } = buildBrushOption(
      ctx({ showBrush: true, selectedDataKey: "target" }),
      6,
    );
    expect(miniSeries[0]!.lineStyle?.opacity).toBeCloseTo(0.5 * SELECTION_DIM);
  });
});

describe("loading skeleton", () => {
  it("draws BOTH a bar wave and a line, because this chart is both", () => {
    const frame = buildChartLayout(ctx({ isLoading: true }));
    const axes = buildMainAxes(ctx({ isLoading: true }));
    const option = buildLoadingOption(ctx({ isLoading: true }), {
      grid: frame.grid,
      ...axes,
    });
    const series = option.series as { id: string; type: string }[];
    expect(series.map((s) => s.id)).toEqual(["__loading", "__loading-line"]);
    expect(series.map((s) => s.type)).toEqual(["bar", "line"]);
  });

  it("gives the skeleton line its OWN walk, not the bar tops", () => {
    const frame = buildChartLayout(ctx({ isLoading: true }));
    const axes = buildMainAxes(ctx({ isLoading: true }));
    const option = buildLoadingOption(ctx({ isLoading: true }), {
      grid: frame.grid,
      ...axes,
    });
    const series = option.series as { data: number[] }[];
    expect(series[0]!.data).toEqual([1, 2, 3]);
    expect(series[1]!.data).toEqual([4, 5, 6]);
  });
});

describe("axes", () => {
  it("uses boundaryGap so the bars have room, and the lines follow suit", () => {
    expect(buildMainAxes(ctx()).xAxis.boundaryGap).toBe(true);
  });
});

describe("tooltip formatter", () => {
  it("drops glow copies and the mini chart", () => {
    const html = createTooltipFormatter(ctx())([
      { seriesId: "__glow-target-0", value: 30, axisValue: "Jan" },
      { seriesId: "__mini-revenue", value: 10, axisValue: "Jan" },
    ]);
    expect(html).not.toContain("Target");
    expect(html).not.toContain("Revenue");
  });

  it("renders a row per real series", () => {
    const html = createTooltipFormatter(ctx())([
      { seriesId: "revenue", value: 10, axisValue: "Jan" },
      { seriesId: "target", value: 30, axisValue: "Jan" },
    ]);
    expect(html).toContain("Revenue");
    expect(html).toContain("Target");
  });
});
