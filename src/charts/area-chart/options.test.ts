import { describe, expect, it } from "vitest";

import type { ResolvedColors } from "../../lib/chart-tokens";
import "../../lib/echarts-paint";
import {
  buildAreaSeries,
  buildBrushOption,
  buildChartLayout,
  buildLoadingOption,
  buildMainAxes,
  computePlottedTops,
  createTooltipFormatter,
  getOpacity,
  type OptionBuildContext,
} from "./options";
import {
  BUFFERFILL_PREFIX,
  BUFFER_PREFIX,
  REVEAL_PREFIX,
  type AreaSeriesConfig,
} from "./types";

const TOKENS: ResolvedColors["tokens"] = {
  mutedForeground: "rgba(100, 100, 100, 1)",
  border: "rgba(200, 200, 200, 0.5)",
  foreground: "rgba(0, 0, 0, 1)",
  background: "rgba(255, 255, 255, 1)",
};

const DATA = [
  { month: "Jan", desktop: 10, mobile: 30 },
  { month: "Feb", desktop: 20, mobile: 20 },
  { month: "Mar", desktop: 30, mobile: 10 },
];

function area(overrides: Partial<AreaSeriesConfig> = {}): AreaSeriesConfig {
  return {
    dataKey: "desktop",
    variant: "gradient",
    strokeVariant: "dashed",
    strokeWidth: 0.8,
    connectNulls: false,
    isClickable: false,
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
    areas: [area()],
    seriesKeys: ["desktop"],
    curveType: "linear",
    isStacked: false,
    isExpanded: false,
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
    resolved: {
      series: { desktop: ["rgba(0, 170, 0, 1)"], mobile: ["rgba(170, 0, 0, 1)"] },
      tokens: TOKENS,
    },
    rendererSize: { width: 400, height: 300 },
    categories: ["Jan", "Feb", "Mar"],
    brushRange: { start: 0, end: 100 },
    getHoveredKey: () => null,
    ...overrides,
  };
}

describe("getOpacity", () => {
  it("carries a fill, unlike the line chart's", () => {
    expect(getOpacity(null, "desktop")).toEqual({ fill: 0.8, stroke: 1, dot: 1 });
  });

  it("dims the fill hardest — the area body is the dominant visual", () => {
    const dimmed = getOpacity("mobile", "desktop");
    expect(dimmed).toEqual({ fill: 0.1, stroke: 0.3, dot: 0.3 });
    expect(dimmed.fill).toBeLessThan(dimmed.stroke);
  });
});

describe("buildAreaSeries", () => {
  it("gives every series an areaStyle — that is what makes it an area", () => {
    const series = buildAreaSeries(ctx());
    expect(series[0]!.areaStyle).toBeDefined();
    expect(series[0]!.areaStyle?.opacity).toBe(0.8);
  });

  it("defaults the stroke to dashed, unlike <Line>", () => {
    expect(buildAreaSeries(ctx())[0]!.lineStyle?.type).toEqual([3, 3]);
  });

  it("emits no glow series — the area chart has none", () => {
    const series = buildAreaSeries(ctx());
    expect(series.every((s) => !String(s.id).startsWith("__glow"))).toBe(true);
  });

  describe("stacking", () => {
    it("leaves series unstacked by default", () => {
      expect(buildAreaSeries(ctx())[0]!.stack).toBeUndefined();
    });

    it("puts every real series in the shared 'total' stack", () => {
      const series = buildAreaSeries(
        ctx({ isStacked: true, areas: [area(), area({ dataKey: "mobile" })] }),
      );
      expect(series.map((s) => s.stack)).toEqual(["total", "total"]);
    });

    it("normalises each row to a fraction when expanded", () => {
      const series = buildAreaSeries(
        ctx({
          isStacked: true,
          isExpanded: true,
          seriesKeys: ["desktop", "mobile"],
          areas: [area()],
        }),
      );
      // Jan: 10 / (10 + 30) = 0.25
      expect(series[0]!.data).toEqual([0.25, 0.5, 0.75]);
    });

    it("guards against a zero row total", () => {
      const series = buildAreaSeries(
        ctx({
          data: [{ month: "Jan", desktop: 0, mobile: 0 }],
          isStacked: true,
          isExpanded: true,
          seriesKeys: ["desktop", "mobile"],
        }),
      );
      expect(series[0]!.data).toEqual([0]);
    });
  });

  describe("buffer area", () => {
    const series = buildAreaSeries(ctx({ areas: [area({ enableBufferLine: true })] }));

    it("splits into body, dashed tail, and a fill patch", () => {
      expect(series.map((s) => s.id)).toEqual([
        "desktop",
        `${BUFFER_PREFIX}desktop`,
        `${BUFFERFILL_PREFIX}desktop`,
      ]);
    });

    it("gives the tail a stroke but no fill", () => {
      expect(series[1]!.lineStyle?.type).toEqual([4, 3]);
      expect(series[1]!.areaStyle).toBeUndefined();
    });

    it("gives the patch a fill but no visible stroke", () => {
      expect(series[2]!.areaStyle).toBeDefined();
      expect(series[2]!.lineStyle?.opacity).toBe(0);
      expect(series[2]!.showSymbol).toBe(false);
    });

    it("puts the patch one z below so it never covers the real area", () => {
      expect(series[2]!.z).toBe((series[0]!.z as number) - 1);
    });

    it("gives each companion its OWN mirror stack so heights don't double", () => {
      const stacked = buildAreaSeries(
        ctx({ isStacked: true, areas: [area({ enableBufferLine: true })] }),
      );
      expect(stacked.map((s) => s.stack)).toEqual([
        "total",
        "__buffer-total",
        "__bufferfill-total",
      ]);
    });
  });

  describe("hover reveal", () => {
    it("adds a muted base with its own mirror stack", () => {
      const series = buildAreaSeries(ctx({ isStacked: true, enableHoverReveal: true }));
      expect(series[0]!.id).toBe(`${REVEAL_PREFIX}desktop`);
      expect(series[0]!.stack).toBe("__reveal-total");
      expect(series[1]!.stack).toBe("total");
    });

    it("gives the base no fill — it is a boundary line, not a band", () => {
      const series = buildAreaSeries(ctx({ enableHoverReveal: true }));
      expect(series[0]!.areaStyle).toBeUndefined();
    });

    it("takes precedence over a buffer tail", () => {
      const series = buildAreaSeries(
        ctx({ enableHoverReveal: true, areas: [area({ enableBufferLine: true })] }),
      );
      expect(series.map((s) => s.id)).toEqual([`${REVEAL_PREFIX}desktop`, "desktop"]);
    });
  });

  it("dims an unselected area's fill to 0.1", () => {
    const series = buildAreaSeries(ctx({ selectedDataKey: "mobile", hasSelection: true }));
    expect(series[0]!.areaStyle?.opacity).toBe(0.1);
  });
});

describe("computePlottedTops", () => {
  it("returns raw values when unstacked", () => {
    const tops = computePlottedTops(ctx({ areas: [area(), area({ dataKey: "mobile" })] }));
    expect(tops.desktop).toEqual([10, 20, 30]);
    expect(tops.mobile).toEqual([30, 20, 10]);
  });

  it("accumulates in declaration order when stacked", () => {
    const tops = computePlottedTops(
      ctx({ isStacked: true, areas: [area(), area({ dataKey: "mobile" })] }),
    );
    expect(tops.desktop).toEqual([10, 20, 30]);
    // mobile sits on top of desktop.
    expect(tops.mobile).toEqual([40, 40, 40]);
  });

  it("accumulates fractions when expanded", () => {
    const tops = computePlottedTops(
      ctx({
        isStacked: true,
        isExpanded: true,
        seriesKeys: ["desktop", "mobile"],
        areas: [area(), area({ dataKey: "mobile" })],
      }),
    );
    expect(tops.desktop).toEqual([0.25, 0.5, 0.75]);
    // Every column reaches exactly 1.
    expect(tops.mobile).toEqual([1, 1, 1]);
  });
});

describe("buildBrushOption", () => {
  it("gives the mini chart a fill, unlike the line chart's", () => {
    const { miniSeries } = buildBrushOption(ctx({ showBrush: true }), 6);
    expect(miniSeries[0]!.areaStyle).toBeDefined();
  });

  it("puts the mini chart in its own mirror stack", () => {
    const { miniSeries } = buildBrushOption(ctx({ showBrush: true, isStacked: true }), 6);
    expect(miniSeries[0]!.stack).toBe("__mini-total");
  });

  it("keeps the mini chart on the second grid so it never filters itself", () => {
    const { miniSeries, miniGrid } = buildBrushOption(ctx({ showBrush: true }), 6);
    expect(miniSeries[0]!.xAxisIndex).toBe(1);
    expect(miniSeries[0]!.yAxisIndex).toBe(1);
    expect(miniGrid.outerBoundsMode).toBe("none");
  });
});

describe("buildLoadingOption", () => {
  it("carries a fill as well as a stroke, unlike the line skeleton", () => {
    const frame = buildChartLayout(ctx({ isLoading: true }));
    const axes = buildMainAxes(ctx({ isLoading: true }));
    const option = buildLoadingOption(ctx({ isLoading: true }), {
      grid: frame.grid,
      ...axes,
    });
    const series = option.series as {
      lineStyle: { color: string };
      areaStyle: { color: string };
    }[];
    expect(series[0]!.areaStyle.color).toBe("rgba(0, 0, 0, 0.000)");
    expect(series[0]!.lineStyle.color).toBe("rgba(0, 0, 0, 0.000)");
  });
});

describe("createTooltipFormatter", () => {
  const format = (params: unknown, overrides: Partial<OptionBuildContext> = {}) =>
    createTooltipFormatter(ctx(overrides))(params);

  it("folds a buffer overlay back onto its parent", () => {
    const html = format([
      { seriesId: `${BUFFER_PREFIX}desktop`, value: 30, axisValue: "Mar" },
    ]);
    expect(html).toContain("Desktop");
    expect(html).toContain("30");
  });

  it("drops the bufferfill patch — it carries no distinct value", () => {
    // "__bufferfill-" does NOT match "__buffer-" (the char after "buffer"
    // differs), so it falls to the generic "__" drop rather than being
    // mistaken for the tail. Easy to break by "simplifying" the prefixes.
    const html = format([
      { seriesId: `${BUFFERFILL_PREFIX}desktop`, value: 30, axisValue: "Mar" },
    ]);
    expect(html).not.toContain("Desktop");
  });

  it("drops the reveal base and the mini chart", () => {
    const html = format([
      { seriesId: `${REVEAL_PREFIX}desktop`, value: 1, axisValue: "Jan" },
      { seriesId: "__mini-desktop", value: 2, axisValue: "Jan" },
    ]);
    expect(html).not.toContain("Desktop");
  });
});
