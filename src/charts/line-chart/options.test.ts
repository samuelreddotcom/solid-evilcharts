import { describe, expect, it } from "vitest";

import type { ResolvedColors } from "../../lib/chart-tokens";
import "../../lib/echarts-paint";
import {
  buildChartLayout,
  buildGlowSeries,
  buildLineSeries,
  buildLoadingOption,
  buildMainAxes,
  createTooltipFormatter,
  curveConfig,
  getLoadingData,
  getOpacity,
  shimmerWindowStops,
  sliceFrom,
  sliceToNull,
  type OptionBuildContext,
  type XAxisOption,
} from "./options";
import { BUFFER_PREFIX, GLOW_LAYERS, REVEAL_PREFIX, type LineSeriesConfig } from "./types";

const TOKENS: ResolvedColors["tokens"] = {
  mutedForeground: "rgba(100, 100, 100, 1)",
  border: "rgba(200, 200, 200, 0.5)",
  foreground: "rgba(0, 0, 0, 1)",
  background: "rgba(255, 255, 255, 1)",
};

const DATA = [
  { month: "Jan", desktop: 10, mobile: 5 },
  { month: "Feb", desktop: 20, mobile: 8 },
  { month: "Mar", desktop: 15, mobile: 12 },
];

function line(overrides: Partial<LineSeriesConfig> = {}): LineSeriesConfig {
  return {
    dataKey: "desktop",
    strokeVariant: "solid",
    strokeWidth: 0.8,
    connectNulls: false,
    isClickable: false,
    glowing: false,
    enableBufferLine: false,
    dotVariant: "none",
    activeDotVariant: "none",
    ...overrides,
  };
}

function ctx(overrides: Partial<OptionBuildContext> = {}): OptionBuildContext {
  return {
    data: DATA,
    config: { desktop: { label: "Desktop", colors: { light: ["#0a0"] } } },
    lines: [line()],
    curveType: "linear",
    selectedDataKey: null,
    hasSelection: false,
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
    showBrush: false,
    brushHeight: 56,
    enableHoverHighlight: false,
    enableHoverReveal: false,
    revealIndex: null,
    revealSink: {},
    resolved: { series: { desktop: ["rgba(0, 170, 0, 1)"] }, tokens: TOKENS },
    rendererSize: { width: 400, height: 300 },
    categories: ["Jan", "Feb", "Mar"],
    brushRange: { start: 0, end: 100 },
    getHoveredKey: () => null,
    ...overrides,
  };
}

describe("curveConfig", () => {
  it("maps step to a MIDPOINT step so dots sit centred on their plateau", () => {
    expect(curveConfig("step")).toEqual({ smooth: false, step: "middle" });
  });

  it("maps linear to a straight, unsmoothed line", () => {
    expect(curveConfig("linear")).toEqual({ smooth: false, step: false });
  });

  it("smooths everything else", () => {
    for (const type of ["smooth", "bump", "monotone", "natural"] as const) {
      expect(curveConfig(type)).toEqual({ smooth: true, step: false });
    }
  });
});

describe("getOpacity", () => {
  it("leaves everything opaque when nothing is selected", () => {
    expect(getOpacity(null, "desktop")).toEqual({ stroke: 1, dot: 1 });
  });

  it("leaves the selected series opaque", () => {
    expect(getOpacity("desktop", "desktop")).toEqual({ stroke: 1, dot: 1 });
  });

  it("dims the others", () => {
    expect(getOpacity("mobile", "desktop")).toEqual({ stroke: 0.3, dot: 0.3 });
  });
});

describe("slice helpers", () => {
  it("sliceToNull keeps up to and including the index", () => {
    expect(sliceToNull([1, 2, 3, 4], 1)).toEqual([1, 2, null, null]);
  });

  it("sliceFrom keeps from the index onward", () => {
    expect(sliceFrom([1, 2, 3, 4], 1)).toEqual([null, 2, 3, 4]);
  });

  it("both include the boundary so the two halves meet at the pointer", () => {
    const idx = 2;
    const toNull = sliceToNull([1, 2, 3, 4], idx);
    const from = sliceFrom([1, 2, 3, 4], idx);
    expect(toNull[idx]).toBe(3);
    expect(from[idx]).toBe(3);
  });
});

describe("getLoadingData", () => {
  it("stays inside the comfortable band", () => {
    const rows = getLoadingData(200);
    expect(rows).toHaveLength(200);
    expect(Math.min(...rows)).toBeGreaterThanOrEqual(16);
    expect(Math.max(...rows)).toBeLessThanOrEqual(58);
  });
});

describe("shimmerWindowStops", () => {
  it("returns ascending, de-duplicated offsets inside [0, 1]", () => {
    const stops = shimmerWindowStops(0.5, "rgba(0, 0, 0, 1)", 0.5);
    const offsets = stops.map((s) => s.offset);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(Math.min(...offsets)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...offsets)).toBeLessThanOrEqual(1);
    expect(new Set(offsets).size).toBe(offsets.length);
  });

  it("is fully transparent outside the window", () => {
    const stops = shimmerWindowStops(0.5, "rgba(0, 0, 0, 1)", 0.5);
    expect(stops[0]!.color).toBe("rgba(0, 0, 0, 0.000)");
  });

  it("reaches peak alpha at the window centre", () => {
    const stops = shimmerWindowStops(0.5, "rgba(0, 0, 0, 1)", 0.5);
    const centre = stops.find((s) => Math.abs(s.offset - 0.5) < 1e-9);
    expect(centre!.color).toBe("rgba(0, 0, 0, 0.500)");
  });

  it("still produces stops when the window is off-screen", () => {
    expect(shimmerWindowStops(-0.5, "rgba(0, 0, 0, 1)", 0.5).length).toBeGreaterThan(0);
    expect(shimmerWindowStops(1.5, "rgba(0, 0, 0, 1)", 0.5).length).toBeGreaterThan(0);
  });
});

describe("buildChartLayout", () => {
  it("reserves no footer without a brush", () => {
    expect(buildChartLayout(ctx()).grid.bottom).toBe(8);
  });

  it("reserves the brush height plus label clearance", () => {
    const { grid } = buildChartLayout(ctx({ showBrush: true, brushHeight: 56 }));
    expect(grid.bottom).toBe(8 + 56 + 30);
  });

  it("adds a band for an x-axis title above the brush frame", () => {
    const { grid } = buildChartLayout(
      ctx({
        showBrush: true,
        xAxisSlot: { present: true, hideDots: false, label: "Month" },
      }),
    );
    expect(grid.bottom).toBe(8 + 56 + 30 + 22);
  });

  it("makes room at the top for a top-aligned legend", () => {
    const base = ctx();
    expect(buildChartLayout(base).grid.top).toBe(16);
    expect(
      buildChartLayout(
        ctx({ legendSlot: { ...base.legendSlot, present: true, verticalAlign: "top" } }),
      ).grid.top,
    ).toBe(42);
  });

  it("lifts the brush for a bottom-aligned legend", () => {
    const base = ctx();
    expect(buildChartLayout(base).brushBottom).toBe(6);
    expect(
      buildChartLayout(
        ctx({
          legendSlot: { ...base.legendSlot, present: true, verticalAlign: "bottom" },
        }),
      ).brushBottom,
    ).toBe(34);
  });
});

describe("buildMainAxes", () => {
  it("keeps the y-axis alive for the grid even without a <YAxis>", () => {
    const { yAxis } = buildMainAxes(ctx({ showGrid: true }));
    expect(yAxis.show).toBe(true);
    // Grid draws, labels don't — <Grid/> is present but <YAxis/> is not.
    expect(yAxis.splitLine?.show).toBe(true);
    expect(yAxis.axisLabel?.show).toBe(false);
  });

  it("hides the grid and labels while loading", () => {
    const { xAxis, yAxis } = buildMainAxes(
      ctx({
        showGrid: true,
        isLoading: true,
        yAxisSlot: { present: true, hideDots: false },
      }),
    );
    expect(yAxis.splitLine?.show).toBe(false);
    expect(yAxis.axisLabel?.show).toBe(false);
    expect(xAxis.axisLabel?.show).toBe(false);
  });

  // XAxisOption is a union across axis types; `data` lives only on the category
  // variant, which is the one this chart always builds.
  const categoryData = (axis: XAxisOption) =>
    (axis as { data?: unknown[] }).data;

  it("swaps in skeleton indices for the categories while loading", () => {
    const { xAxis } = buildMainAxes(ctx({ isLoading: true, loadingData: () => [5, 6] }));
    expect(categoryData(xAxis)).toEqual([0, 1]);
  });

  it("uses categories when not loading", () => {
    expect(categoryData(buildMainAxes(ctx()).xAxis)).toEqual(["Jan", "Feb", "Mar"]);
  });

  it("hides tick dots on request", () => {
    const { xAxis } = buildMainAxes(
      ctx({ xAxisSlot: { present: true, hideDots: true } }),
    );
    expect(xAxis.axisTick?.show).toBe(false);
  });

  it("flattens the tick dot colour so overlapping round caps don't stack", () => {
    const { xAxis } = buildMainAxes(
      ctx({ xAxisSlot: { present: true, hideDots: false } }),
    );
    // border is 50% grey over a white background → opaque mid grey.
    expect(xAxis.axisTick?.lineStyle?.color).toBe("rgb(228, 228, 228)");
  });
});

describe("buildLineSeries", () => {
  it("emits one series per line, keyed by dataKey", () => {
    const series = buildLineSeries(ctx());
    expect(series).toHaveLength(1);
    expect(series[0]!.id).toBe("desktop");
    expect(series[0]!.data).toEqual([10, 20, 15]);
  });

  it("names the series from the config label", () => {
    expect(buildLineSeries(ctx())[0]!.name).toBe("Desktop");
  });

  it("z-orders the selected series above, and others below, the default", () => {
    const selected = buildLineSeries(
      ctx({ selectedDataKey: "desktop", hasSelection: true }),
    );
    expect(selected[0]!.z).toBe(3);

    const other = buildLineSeries(ctx({ selectedDataKey: "mobile", hasSelection: true }));
    expect(other[0]!.z).toBe(1);

    expect(buildLineSeries(ctx())[0]!.z).toBe(2);
  });

  describe("buffer line", () => {
    const series = buildLineSeries(
      ctx({ lines: [line({ enableBufferLine: true, strokeVariant: "dashed" })] }),
    );

    it("splits into a solid body and a dashed tail overlay", () => {
      expect(series).toHaveLength(2);
      expect(series[0]!.id).toBe("desktop");
      expect(series[1]!.id).toBe(`${BUFFER_PREFIX}desktop`);
    });

    it("drops the last point from the body and keeps only the tail in the overlay", () => {
      expect(series[0]!.data).toEqual([10, 20, null]);
      expect(series[1]!.data).toEqual([null, 20, 15]);
    });

    it("forces the body solid even when strokeVariant is dashed", () => {
      // The tail manages its own dash; the body must not double up.
      expect(series[0]!.lineStyle?.type).toBe("solid");
      expect(series[1]!.lineStyle?.type).toEqual([4, 3]);
    });

    it("makes the tail silent so it never intercepts clicks", () => {
      expect(series[1]!.silent).toBe(true);
    });

    it("needs at least two points", () => {
      const short = buildLineSeries(
        ctx({ data: [DATA[0]!], lines: [line({ enableBufferLine: true })] }),
      );
      expect(short).toHaveLength(1);
    });
  });

  describe("hover reveal", () => {
    it("adds a muted base layer one z below the real line", () => {
      const series = buildLineSeries(ctx({ enableHoverReveal: true }));
      expect(series).toHaveLength(2);
      expect(series[0]!.id).toBe(`${REVEAL_PREFIX}desktop`);
      expect(series[0]!.z).toBe(1);
      expect(series[1]!.z).toBe(2);
    });

    it("keeps the base invisible while idle so the chart looks normal", () => {
      const series = buildLineSeries(ctx({ enableHoverReveal: true }));
      expect(series[0]!.lineStyle?.opacity).toBe(0);
      expect(series[1]!.data).toEqual([10, 20, 15]);
    });

    it("cuts the real line at the cursor and shows grey from there on", () => {
      const series = buildLineSeries(ctx({ enableHoverReveal: true, revealIndex: 1 }));
      expect(series[1]!.data).toEqual([10, 20, null]);
      expect(series[0]!.data).toEqual([null, 20, 15]);
      expect(series[0]!.lineStyle?.opacity).toBe(0.3);
    });

    it("fills the reveal sink with the full per-datum points", () => {
      const sink: Record<string, unknown[]> = {};
      buildLineSeries(ctx({ enableHoverReveal: true, revealSink: sink }));
      expect(sink.desktop).toEqual([10, 20, 15]);
    });

    it("takes precedence over a buffer tail and the glow", () => {
      const series = buildLineSeries(
        ctx({
          enableHoverReveal: true,
          lines: [line({ enableBufferLine: true, glowing: true })],
        }),
      );
      expect(series.map((s) => s.id)).toEqual([`${REVEAL_PREFIX}desktop`, "desktop"]);
    });
  });

  describe("glow", () => {
    it("stacks one silent copy per GLOW_LAYER beneath the real line", () => {
      const series = buildLineSeries(ctx({ lines: [line({ glowing: true })] }));
      expect(series).toHaveLength(GLOW_LAYERS.length + 1);
      expect(series.slice(0, GLOW_LAYERS.length).every((s) => s.silent)).toBe(true);
      expect(series.at(-1)!.id).toBe("desktop");
    });

    it("shares the parent's z so array order decides painting", () => {
      const series = buildLineSeries(ctx({ lines: [line({ glowing: true })] }));
      expect(series.every((s) => s.z === 2)).toBe(true);
    });
  });

  describe("hover highlight", () => {
    it("arms focus:series only when highlight is on and nothing is selected", () => {
      expect(buildLineSeries(ctx())[0]!.emphasis?.focus).toBe("none");
      expect(
        buildLineSeries(ctx({ enableHoverHighlight: true }))[0]!.emphasis?.focus,
      ).toBe("series");
    });

    it("stands down while a series is click-selected", () => {
      const series = buildLineSeries(
        ctx({ enableHoverHighlight: true, selectedDataKey: "desktop", hasSelection: true }),
      );
      expect(series[0]!.emphasis?.focus).toBe("none");
    });

    it("stands down when reveal owns the hover visual", () => {
      const series = buildLineSeries(
        ctx({ enableHoverHighlight: true, enableHoverReveal: true }),
      );
      expect(series.at(-1)!.emphasis?.focus).toBe("none");
    });
  });

  it("only makes a line clickable when asked", () => {
    expect(buildLineSeries(ctx())[0]!.triggerEvent).toBe(false);
    const clickable = buildLineSeries(ctx({ lines: [line({ isClickable: true })] }));
    expect(clickable[0]!.triggerEvent).toBe(true);
    expect(clickable[0]!.cursor).toBe("pointer");
  });
});

describe("buildGlowSeries", () => {
  it("scales every layer's opacity by the selection dim", () => {
    const dimmed = buildGlowSeries({
      key: "desktop",
      paint: "rgba(0, 170, 0, 1)",
      slots: ["rgba(0, 170, 0, 1)"],
      values: [1, 2],
      curve: { smooth: false, step: false },
      connectNulls: false,
      z: 2,
      selectionDim: 0.3,
      dotSize: 0,
    });
    expect(dimmed[0]!.lineStyle?.opacity).toBeCloseTo(GLOW_LAYERS[0]!.opacity * 0.3);
  });

  it("keeps every layer the same narrow width — the halo comes from shadowBlur", () => {
    const glow = buildGlowSeries({
      key: "desktop",
      paint: "rgba(0, 170, 0, 1)",
      slots: ["rgba(0, 170, 0, 1)"],
      values: [1, 2],
      curve: { smooth: false, step: false },
      connectNulls: false,
      z: 2,
      selectionDim: 1,
      dotSize: 0,
    });
    const widths = new Set(glow.map((s) => s.lineStyle?.width));
    expect(widths.size).toBe(1);
    expect(glow.map((s) => s.lineStyle?.shadowBlur)).toEqual(
      GLOW_LAYERS.map((l) => l.blur),
    );
  });
});

describe("createTooltipFormatter", () => {
  const format = (params: unknown, overrides: Partial<OptionBuildContext> = {}) =>
    createTooltipFormatter(ctx(overrides))(params);

  it("renders a row per series with the raw axis label", () => {
    const html = format([{ seriesId: "desktop", seriesName: "Desktop", value: 20, axisValue: "Feb" }]);
    expect(html).toContain("Feb");
    expect(html).toContain("Desktop");
    expect(html).toContain("20");
  });

  it("folds a buffer overlay back onto its parent series", () => {
    const html = format([
      { seriesId: `${BUFFER_PREFIX}desktop`, value: 15, axisValue: "Mar" },
    ]);
    expect(html).toContain("Desktop");
    expect(html).not.toContain(BUFFER_PREFIX);
  });

  it("drops internal series entirely", () => {
    const html = format([
      { seriesId: "__mini-desktop", value: 1, axisValue: "Jan" },
      { seriesId: "__loading", value: 2, axisValue: "Jan" },
    ]);
    // Shell renders, but with no rows.
    expect(html).toContain("Jan");
    expect(html).not.toContain("__mini");
  });

  it("keeps only the first non-null value per key", () => {
    const html = format([
      { seriesId: "desktop", value: null, axisValue: "Mar" },
      { seriesId: `${BUFFER_PREFIX}desktop`, value: 15, axisValue: "Mar" },
    ]);
    expect(html.match(/Desktop/g)).toHaveLength(1);
    expect(html).toContain("15");
  });

  it("dims rows for series that are neither selected nor hovered", () => {
    const html = format([{ seriesId: "desktop", value: 20, axisValue: "Feb" }], {
      selectedDataKey: "mobile",
    });
    expect(html).toContain("opacity-30");
  });

  it("returns empty string for no rows", () => {
    expect(format([])).toBe("");
  });
});

describe("buildLoadingOption", () => {
  it("draws a single stroke-only skeleton with animation off", () => {
    const frame = buildChartLayout(ctx({ isLoading: true }));
    const axes = buildMainAxes(ctx({ isLoading: true }));
    const option = buildLoadingOption(ctx({ isLoading: true }), {
      grid: frame.grid,
      ...axes,
    });

    expect(option.animation).toBe(false);
    const series = option.series as { id: string; silent: boolean }[];
    expect(series).toHaveLength(1);
    expect(series[0]!.id).toBe("__loading");
    expect(series[0]!.silent).toBe(true);
  });

  it("starts fully transparent until the first shimmer tick", () => {
    const frame = buildChartLayout(ctx({ isLoading: true }));
    const axes = buildMainAxes(ctx({ isLoading: true }));
    const option = buildLoadingOption(ctx({ isLoading: true }), {
      grid: frame.grid,
      ...axes,
    });
    const series = option.series as { lineStyle: { color: string } }[];
    expect(series[0]!.lineStyle.color).toBe("rgba(0, 0, 0, 0.000)");
  });
});
