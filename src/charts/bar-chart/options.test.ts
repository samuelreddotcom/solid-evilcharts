import { describe, expect, it } from "vitest";

import type { ResolvedColors } from "../../lib/chart-tokens";
import "../../lib/echarts-paint";
import {
  barStaggerDelay,
  buildBarSeries,
  buildBrushOption,
  buildMainAxes,
  buildTooltipOption,
  findMaxColumnIndex,
  selectionOpacity,
  type OptionBuildContext,
} from "./options";
import { BAR_STAGGER, SELECTION_DIM, type BarSeriesConfig } from "./types";

const TOKENS: ResolvedColors["tokens"] = {
  mutedForeground: "rgba(100, 100, 100, 1)",
  border: "rgba(200, 200, 200, 0.5)",
  foreground: "rgba(0, 0, 0, 1)",
  background: "rgba(255, 255, 255, 1)",
};

const DATA = [
  { month: "Jan", desktop: 10, mobile: 30 },
  { month: "Feb", desktop: 20, mobile: 20 },
  { month: "Mar", desktop: 90, mobile: 10 },
];

function bar(overrides: Partial<BarSeriesConfig> = {}): BarSeriesConfig {
  return {
    dataKey: "desktop",
    variant: "default",
    isClickable: false,
    enableHoverHighlight: false,
    glowing: false,
    bufferBar: false,
    ...overrides,
  };
}

function ctx(overrides: Partial<OptionBuildContext> = {}): OptionBuildContext {
  return {
    data: DATA,
    config: { desktop: { label: "Desktop", colors: { light: ["#0a0"] } } },
    bars: [bar()],
    seriesKeys: ["desktop"],
    animationType: "left-to-right",
    barRadius: 2,
    isHorizontal: false,
    isStacked: false,
    isPercent: false,
    selectedDataKey: null,
    hasSelection: false,
    showGrid: false,
    categorySlot: { present: false, hideDots: false },
    valueSlot: { present: false, hideDots: false },
    tooltipSlot: {
      present: false,
      variant: "default",
      roundness: "lg",
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
    resolved: {
      series: { desktop: ["rgba(0, 170, 0, 1)"], mobile: ["rgba(170, 0, 0, 1)"] },
      tokens: TOKENS,
    },
    categories: ["Jan", "Feb", "Mar"],
    brushRange: { start: 0, end: 100 },
    valuePxPerUnit: null,
    barWidthPx: null,
    expand: { key: null, hovered: null, progress: new Map() },
    maxHighlightIndex: null,
    getHoveredKey: () => null,
    ...overrides,
  };
}

describe("selectionOpacity", () => {
  it("only dims a DIFFERENT series", () => {
    expect(selectionOpacity(null, "desktop")).toBe(1);
    expect(selectionOpacity("desktop", "desktop")).toBe(1);
    expect(selectionOpacity("mobile", "desktop")).toBe(SELECTION_DIM);
  });
});

describe("barStaggerDelay", () => {
  it("is flat when animation is off", () => {
    expect(barStaggerDelay("none", 3, 10)).toBe(0);
  });

  it("counts up left-to-right", () => {
    expect(barStaggerDelay("left-to-right", 0, 5)).toBe(0);
    expect(barStaggerDelay("left-to-right", 4, 5)).toBe(4 * BAR_STAGGER);
  });

  it("counts down right-to-left", () => {
    expect(barStaggerDelay("right-to-left", 0, 5)).toBe(4 * BAR_STAGGER);
    expect(barStaggerDelay("right-to-left", 4, 5)).toBe(0);
  });

  it("starts at the centre for center-out", () => {
    // 5 bars → centre index 2.
    expect(barStaggerDelay("center-out", 2, 5)).toBe(0);
    expect(barStaggerDelay("center-out", 0, 5)).toBe(2 * BAR_STAGGER);
    expect(barStaggerDelay("center-out", 4, 5)).toBe(2 * BAR_STAGGER);
  });

  it("starts at the edges for edges-in — the mirror of center-out", () => {
    expect(barStaggerDelay("edges-in", 0, 5)).toBe(0);
    expect(barStaggerDelay("edges-in", 4, 5)).toBe(0);
    expect(barStaggerDelay("edges-in", 2, 5)).toBe(2 * BAR_STAGGER);
  });
});

describe("findMaxColumnIndex", () => {
  it("compares COLUMN totals, not individual bars", () => {
    // desktop peaks at index 2; mobile peaks at index 0. Totals: 40, 40, 100.
    expect(findMaxColumnIndex(DATA, ["desktop", "mobile"])).toBe(2);
  });

  it("keeps the first winner on a tie", () => {
    const tied = [
      { a: 1, b: 1 },
      { a: 1, b: 1 },
    ];
    expect(findMaxColumnIndex(tied, ["a", "b"])).toBe(0);
  });

  it("returns null with no data or no series", () => {
    expect(findMaxColumnIndex([], ["a"])).toBeNull();
    expect(findMaxColumnIndex(DATA, [])).toBeNull();
  });
});

describe("buildBarSeries", () => {
  it("emits bare numbers when no datum needs an override", () => {
    // Keeping plain values lets the series-level itemStyle apply untouched.
    expect(buildBarSeries(ctx())[0]!.data).toEqual([10, 20, 90]);
  });

  it("normalises rows for a percent stack and caps the axis at 1", () => {
    const percent = ctx({
      isStacked: true,
      isPercent: true,
      seriesKeys: ["desktop", "mobile"],
    });
    expect(buildBarSeries(percent)[0]!.data).toEqual([0.25, 0.5, 0.9]);
    const { yAxis } = buildMainAxes(percent);
    expect(yAxis.max).toBe(1);
  });

  describe("stack segment gaps", () => {
    it("skips the spacer before the axis has been measured", () => {
      const series = buildBarSeries(
        ctx({ isStacked: true, bars: [bar(), bar({ dataKey: "mobile" })] }),
      );
      expect(series.map((s) => s.id)).toEqual(["desktop", "mobile"]);
    });

    it("inserts a transparent spacer between adjacent segments once measured", () => {
      const series = buildBarSeries(
        ctx({
          isStacked: true,
          valuePxPerUnit: 2,
          bars: [bar(), bar({ dataKey: "mobile" })],
        }),
      );
      expect(series.map((s) => s.id)).toEqual(["desktop", "__stackgap-0", "mobile"]);
      const spacer = series[1]!;
      expect(spacer.itemStyle?.color).toBe("transparent");
      expect(spacer.silent).toBe(true);
      // 4px gap ÷ 2px-per-unit = 2 data units.
      expect(spacer.data).toEqual([2, 2, 2]);
    });

    it("adds no trailing spacer after the last segment", () => {
      const series = buildBarSeries(
        ctx({
          isStacked: true,
          valuePxPerUnit: 2,
          bars: [bar(), bar({ dataKey: "mobile" })],
        }),
      );
      expect(series.at(-1)!.id).toBe("mobile");
    });

    it("skips spacers entirely for a single series", () => {
      const series = buildBarSeries(ctx({ isStacked: true, valuePxPerUnit: 2 }));
      expect(series).toHaveLength(1);
    });
  });

  describe("buffer bar", () => {
    it("overrides only the LAST datum", () => {
      const series = buildBarSeries(ctx({ bars: [bar({ bufferBar: true })] }));
      const data = series[0]!.data as unknown[];
      expect(typeof data[0]).toBe("number");
      expect(typeof data[2]).toBe("object");
    });

    it("gives the buffer datum a series-coloured outline", () => {
      const series = buildBarSeries(ctx({ bars: [bar({ bufferBar: true })] }));
      const last = (series[0]!.data as { itemStyle: Record<string, unknown> }[])[2]!;
      expect(last.itemStyle.borderColor).toBe("rgba(0, 170, 0, 1)");
      expect(last.itemStyle.borderWidth).toBe(1);
    });
  });

  describe("max value highlight", () => {
    it("mutes every column but the winner", () => {
      const series = buildBarSeries(ctx({ maxHighlightIndex: 2 }));
      const data = series[0]!.data as { itemStyle: Record<string, unknown> }[];
      expect(data[0]!.itemStyle.color).toBe("rgba(100, 100, 100, 0.160)");
      expect(data[2]!.itemStyle.color).toBeUndefined();
    });

    it("haloes only the winner", () => {
      const series = buildBarSeries(ctx({ maxHighlightIndex: 2 }));
      const data = series[0]!.data as { itemStyle: Record<string, unknown> }[];
      expect(data[0]!.itemStyle.shadowBlur).toBeUndefined();
      expect(data[2]!.itemStyle.shadowBlur).toBe(18);
    });
  });

  it("haloes every bar when glowing", () => {
    const series = buildBarSeries(ctx({ bars: [bar({ glowing: true })] }));
    const data = series[0]!.data as { itemStyle: Record<string, unknown> }[];
    expect(data.every((d) => d.itemStyle.shadowBlur === 18)).toBe(true);
  });

  describe("hover highlight", () => {
    it("is disabled unless the bar opts in", () => {
      expect(buildBarSeries(ctx())[0]!.emphasis).toEqual({ disabled: true });
    });

    it("focuses self when enabled and nothing is selected", () => {
      const series = buildBarSeries(ctx({ bars: [bar({ enableHoverHighlight: true })] }));
      expect(series[0]!.emphasis).toEqual({
        focus: "self",
        blurScope: "coordinateSystem",
      });
    });

    it("stands down while a selection owns the dim", () => {
      const series = buildBarSeries(
        ctx({
          bars: [bar({ enableHoverHighlight: true })],
          selectedDataKey: "mobile",
          hasSelection: true,
        }),
      );
      expect(series[0]!.emphasis).toEqual({ disabled: true });
    });
  });

  it("sizes blocks segments from the measured bar width once known", () => {
    // Without a canvas the pattern is null, so this only asserts it does not
    // throw and still produces a paint.
    const series = buildBarSeries(ctx({ bars: [bar({ variant: "blocks" })], barWidthPx: 24 }));
    expect(series[0]!.showBackground).toBe(true);
    expect(series[0]!.itemStyle?.color).toBeDefined();
  });

  it("opens only the hovered datum of an expandable bar", () => {
    const progress = new Map([[1, 1]]);
    const series = buildBarSeries(
      ctx({
        bars: [bar({ variant: "expandable" })],
        expand: { key: "desktop", hovered: 1, progress },
      }),
    );
    const data = series[0]!.data as { label?: { show: boolean } }[];
    expect(data[1]!.label?.show).toBe(true);
    expect(data[0]!.label?.show).toBe(false);
  });
});

describe("buildMainAxes", () => {
  it("puts categories on x for a vertical layout", () => {
    const { xAxis, yAxis } = buildMainAxes(ctx());
    expect(xAxis.type).toBe("category");
    expect(yAxis.type).toBe("value");
  });

  it("SWAPS the axes for a horizontal layout", () => {
    const { xAxis, yAxis } = buildMainAxes(ctx({ isHorizontal: true }));
    expect(xAxis.type).toBe("value");
    expect(yAxis.type).toBe("category");
  });

  it("inverts the category axis when it moves to y, matching Recharts", () => {
    // Recharts lists its first category at the TOP; ECharts' y axis is bottom-up.
    expect(buildMainAxes(ctx({ isHorizontal: true })).yAxis.inverse).toBe(true);
    expect(buildMainAxes(ctx()).xAxis.inverse).toBe(false);
  });

  it("uses boundaryGap so bars sit BETWEEN ticks", () => {
    const { xAxis } = buildMainAxes(ctx());
    expect(xAxis.boundaryGap).toBe(true);
  });

  it("aligns tick dots with the labels despite boundaryGap", () => {
    // Bars sit between ticks, so ECharts would otherwise drop each dot on the
    // BOUNDARY between categories rather than under its label. alignWithLabel
    // exists only on the CATEGORY variant of the axisTick union.
    const { xAxis } = buildMainAxes(ctx({ categorySlot: { present: true, hideDots: false } }));
    const tick = xAxis.axisTick as { alignWithLabel?: boolean };
    expect(tick.alignWithLabel).toBe(true);
  });

  it("formats the value axis as a percentage when stacked to 100%", () => {
    const { yAxis } = buildMainAxes(ctx({ isPercent: true, valueSlot: { present: true, hideDots: false } }));
    const formatter = yAxis.axisLabel?.formatter as (v: number) => string;
    expect(formatter(0.25)).toBe("25%");
  });
});

describe("buildTooltipOption", () => {
  it("uses a shadow axis pointer rather than the line chart's dashed cursor", () => {
    const option = buildTooltipOption(ctx({ tooltipSlot: { present: true, variant: "default", roundness: "lg", position: "variable" } }));
    expect(option.axisPointer?.type).toBe("shadow");
  });

  it("renders percentages in the rows when stacked to 100%", () => {
    const option = buildTooltipOption(
      ctx({
        isPercent: true,
        tooltipSlot: { present: true, variant: "default", roundness: "lg", position: "variable" },
      }),
    );
    const formatter = option.formatter as (p: unknown) => string;
    const html = formatter([{ seriesId: "desktop", value: 0.25, axisValue: "Jan" }]);
    expect(html).toContain("25%");
  });

  it("drops stack spacers and the mini chart from the rows", () => {
    const option = buildTooltipOption(
      ctx({ tooltipSlot: { present: true, variant: "default", roundness: "lg", position: "variable" } }),
    );
    const formatter = option.formatter as (p: unknown) => string;
    const html = formatter([
      { seriesId: "__stackgap-0", value: 2, axisValue: "Jan" },
      { seriesId: "__mini-desktop", value: 10, axisValue: "Jan" },
    ]);
    expect(html).not.toContain("Desktop");
  });
});

describe("buildBrushOption", () => {
  it("mirrors the stack in its own layer", () => {
    const { miniSeries } = buildBrushOption(ctx({ showBrush: true, isStacked: true }), 6);
    expect(miniSeries[0]!.stack).toBe("__mini-total");
  });

  it("dims unselected series in the mini chart too", () => {
    const { miniSeries } = buildBrushOption(
      ctx({
        showBrush: true,
        hasSelection: true,
        selectedDataKey: "mobile",
        bars: [bar()],
      }),
      6,
    );
    expect(miniSeries[0]!.itemStyle?.opacity).toBeCloseTo(0.5 * SELECTION_DIM);
  });
});
