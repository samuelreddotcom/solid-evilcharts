import { LineChart, type LineSeriesOption } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
  type DataZoomComponentOption,
  type GridComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";

import {
  curveConfig,
  getLoadingData,
  shimmerWindowStops as sharedShimmerWindowStops,
  sliceFrom,
  sliceToNull,
  type CurveType,
} from "../../lib/chart-series";
import {
  FALLBACK_SERIES_COLOR,
  flattenColor,
  getColorsCount,
  withAlpha,
  type ChartConfig,
  type ResolvedColors,
} from "../../lib/chart-tokens";
import { buildBrushDataZoom, type BrushRange } from "../../lib/echarts-brush";
import { dotItemStyle, dotStyle, sampleGradient } from "../../lib/echarts-dot";
import { seriesPaint } from "../../lib/echarts-paint";
import {
  tooltipBaseOption,
  tooltipIndicatorHtml,
  tooltipRow,
  tooltipShell,
} from "../../lib/echarts-tooltip";
import { fillPaint } from "./fills";
import {
  AXIS_POINTER_OPACITY,
  BRUSH_FILLER_OPACITY,
  BRUSH_FILL_OPACITY,
  BRUSH_STROKE_OPACITY,
  BUFFERFILL_PREFIX,
  BUFFER_DASH,
  BUFFER_PREFIX,
  GRID_LINE_OPACITY,
  REVEAL_PREFIX,
  STROKE_WIDTH,
  type AreaSeriesConfig,
  type LegendSlot,
  type TooltipSlot,
  type XAxisSlot,
  type YAxisSlot,
} from "./types";

/**
 * Area chart — pure option builders.
 *
 * Every function maps a snapshot context to an ECharts option fragment; nothing
 * touches reactive state or the chart instance. The two exceptions are
 * `resolveAreaAtPixel`, which needs the live instance for pixel conversion, and
 * `computePlottedTops`, which feeds it.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-area-chart.tsx` (MIT).
 */

/**
 * Modular registration — only what this chart needs. Areas are `type: "line"`
 * series carrying an `areaStyle`, so no separate chart module is required.
 */
echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent]);

export type EChartsOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | DataZoomComponentOption
>;

type ArrayItem<T> = T extends readonly (infer U)[] ? U : T;
export type XAxisOption = ArrayItem<NonNullable<EChartsOption["xAxis"]>>;
export type YAxisOption = ArrayItem<NonNullable<EChartsOption["yAxis"]>>;

type EChartsInstance = ReturnType<typeof echarts.init>;

export type OptionBuildContext = {
  data: Record<string, unknown>[];
  config: ChartConfig;
  areas: AreaSeriesConfig[];
  seriesKeys: string[];
  curveType: CurveType;
  isStacked: boolean;
  isExpanded: boolean;
  selectedDataKey: string | null;
  hasSelection: boolean;
  showGrid: boolean;
  xAxisSlot: XAxisSlot;
  yAxisSlot: YAxisSlot;
  tooltipSlot: TooltipSlot;
  legendSlot: LegendSlot;
  isLoading: boolean;
  loadingData: () => number[];
  showBrush: boolean;
  brushHeight: number;
  enableHoverHighlight: boolean;
  enableHoverReveal: boolean;
  revealIndex: number | null;
  revealSink: Record<string, unknown[]>;
  resolved: ResolvedColors;
  /** 2D gradient textures bake at renderer size. */
  rendererSize: { width: number; height: number };
  categories: string[];
  brushRange: BrushRange;
  getHoveredKey: () => string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Small pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dims a series only when another one is selected.
 *
 * Unlike the line chart's, this carries a `fill` too — an area's body is the
 * dominant visual, so it dims hardest (0.8 → 0.1).
 */
export function getOpacity(selected: string | null, key: string) {
  if (selected === null || selected === key) return { fill: 0.8, stroke: 1, dot: 1 };
  return { fill: 0.1, stroke: 0.3, dot: 0.3 };
}

export { curveConfig, getLoadingData, sliceFrom, sliceToNull };

/** shimmerWindowStops with this repo's withAlpha bound in. */
export function shimmerWindowStops(center: number, color: string, peak: number) {
  return sharedShimmerWindowStops(center, color, peak, withAlpha);
}

type AreaPoint =
  | number
  | null
  | {
      value: number;
      itemStyle: Record<string, unknown>;
      emphasis: { itemStyle: Record<string, unknown> };
    };

// ─────────────────────────────────────────────────────────────────────────────
// Layout + axes
// ─────────────────────────────────────────────────────────────────────────────

export function buildChartLayout(ctx: OptionBuildContext): {
  grid: GridComponentOption;
  brushBottom: number;
} {
  const { legendSlot, xAxisSlot, showBrush, brushHeight } = ctx;
  const legendTop = legendSlot.present && legendSlot.verticalAlign === "top";
  const legendBottom = legendSlot.present && legendSlot.verticalAlign === "bottom";
  const brushGap = showBrush ? brushHeight + 30 + (xAxisSlot.label ? 22 : 0) : 0;

  return {
    grid: {
      left: 8,
      right: 8,
      top: legendTop ? 42 : 16,
      bottom: 8 + brushGap + (legendBottom ? 34 : 0),
    },
    brushBottom: legendBottom ? 34 : 6,
  };
}

export function buildMainAxes(ctx: OptionBuildContext): {
  xAxis: XAxisOption;
  yAxis: YAxisOption;
} {
  const { xAxisSlot, yAxisSlot, showGrid, isLoading, categories, loadingData } = ctx;
  const { tokens } = ctx.resolved;

  const axisLabelColor = tokens.mutedForeground;
  const splitLineColor = withAlpha(tokens.border, GRID_LINE_OPACITY);
  const tickDotColor = flattenColor(splitLineColor, tokens.background);

  const xTickFormatter = xAxisSlot.tickFormatter;
  const yTickFormatter = yAxisSlot.tickFormatter;

  const xAxis: XAxisOption = {
    type: "category",
    boundaryGap: false,
    show: true,
    data: isLoading ? loadingData().map((_, i) => i) : categories,
    name: isLoading ? undefined : xAxisSlot.label,
    nameLocation: "middle",
    nameGap: 30,
    nameTextStyle: { color: axisLabelColor, fontSize: 10 },
    axisLine: { show: false },
    axisTick: {
      show: !isLoading && xAxisSlot.present && !xAxisSlot.hideDots,
      alignWithLabel: true,
      length: 0.5,
      lineStyle: { color: tickDotColor, width: 3, cap: "round" },
    },
    splitLine: { show: false },
    axisLabel: {
      show: !isLoading && xAxisSlot.present,
      color: axisLabelColor,
      fontSize: 10,
      margin: 8,
      formatter: xTickFormatter
        ? (value: string, index: number) => xTickFormatter(value, index)
        : undefined,
    },
  };

  const yAxis: YAxisOption = {
    type: "value",
    show: yAxisSlot.present || showGrid,
    name: isLoading ? undefined : yAxisSlot.label,
    nameLocation: "middle",
    nameGap: 38,
    nameTextStyle: { color: axisLabelColor, fontSize: 10 },
    axisLine: { show: false },
    axisTick: {
      show: yAxisSlot.present && !isLoading && !yAxisSlot.hideDots,
      length: 0.5,
      lineStyle: { color: tickDotColor, width: 3, cap: "round" },
    },
    splitLine: {
      show: showGrid && !isLoading,
      lineStyle: {
        color: splitLineColor,
        type: [3, 3] as [number, number],
        width: 1,
      },
    },
    axisLabel: {
      show: yAxisSlot.present && !isLoading,
      color: axisLabelColor,
      fontSize: 10,
      margin: 8,
      formatter: yTickFormatter
        ? (value: number, index: number) => yTickFormatter(value, index)
        : undefined,
    },
  };

  return { xAxis, yAxis };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────────────────────

export function createTooltipFormatter(ctx: OptionBuildContext) {
  const { config, selectedDataKey, tooltipSlot, getHoveredKey } = ctx;

  return (params: unknown): string => {
    const rows = Array.isArray(params) ? params : [params];
    if (!rows.length) return "";

    const first = rows[0] as { axisValue?: string | number; name?: string };
    const label = String(first.axisValue ?? first.name ?? "");

    const seen = new Set<string>();
    const body = rows
      .map((param) => {
        const p = param as {
          seriesId?: string;
          seriesName?: string;
          value?: number | string | null;
        };
        const rawId = String(p.seriesId ?? "");
        // `__bufferfill-` does NOT match `__buffer-` (the char after "buffer"
        // differs), so it falls through to the generic `__` drop. Intentional:
        // the fill patch carries no distinct value to show.
        const key = rawId.startsWith(BUFFER_PREFIX)
          ? rawId.slice(BUFFER_PREFIX.length)
          : rawId.startsWith("__")
            ? ""
            : (p.seriesId ?? p.seriesName ?? "");
        if (!key) return "";
        if (p.value === null || p.value === undefined) return "";
        if (seen.has(key)) return "";
        seen.add(key);

        const item = config[key];
        const colorsCount = item ? getColorsCount(item) : 1;
        const labelText =
          typeof item?.label === "string" ? item.label : (p.seriesName ?? key);
        const hovered = getHoveredKey();
        const dimmed =
          (selectedDataKey != null && selectedDataKey !== key) ||
          (hovered != null && hovered !== key)
            ? " opacity-30"
            : "";
        const value =
          typeof p.value === "number" ? p.value.toLocaleString() : String(p.value ?? "");

        return tooltipRow({
          indicatorHtml: tooltipIndicatorHtml(key, colorsCount),
          labelText,
          valueText: value,
          dimmed,
        });
      })
      .join("");

    return tooltipShell({
      label,
      body,
      roundness: tooltipSlot.roundness,
      variant: tooltipSlot.variant,
    });
  };
}

export function buildTooltipOption(ctx: OptionBuildContext): TooltipComponentOption {
  const { tooltipSlot, isLoading } = ctx;
  const { tokens } = ctx.resolved;

  return {
    ...tooltipBaseOption({
      present: tooltipSlot.present && !isLoading,
      cursor: tooltipSlot.cursor,
      tokens,
      position: tooltipSlot.position,
      axisPointerColor: withAlpha(tokens.border, AXIS_POINTER_OPACITY),
      strokeWidth: STROKE_WIDTH,
    }),
    formatter: createTooltipFormatter(ctx),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Brush
// ─────────────────────────────────────────────────────────────────────────────

export function buildBrushOption(
  ctx: OptionBuildContext,
  brushBottom: number,
): {
  miniGrid: GridComponentOption;
  miniXAxis: XAxisOption;
  miniYAxis: YAxisOption;
  miniSeries: LineSeriesOption[];
  dataZoom: DataZoomComponentOption[];
} {
  const { data, areas, curveType, isStacked, selectedDataKey, brushHeight, categories } =
    ctx;
  const { tokens } = ctx.resolved;

  const miniGrid: GridComponentOption = {
    left: 8,
    right: 8,
    bottom: brushBottom,
    height: brushHeight,
    outerBoundsMode: "none",
  };

  const miniXAxis: XAxisOption = {
    type: "category",
    gridIndex: 1,
    boundaryGap: false,
    show: false,
    data: categories,
    axisPointer: { show: false },
  };

  const miniYAxis: YAxisOption = { type: "value", gridIndex: 1, show: false };

  const miniSeries: LineSeriesOption[] = areas.map((area) => {
    const key = area.dataKey;
    const base = (ctx.resolved.series[key] ?? [])[0] ?? FALLBACK_SERIES_COLOR;
    const curve = curveConfig(area.curveType ?? curveType);
    const { stroke: strokeDim, fill: fillDim } = getOpacity(selectedDataKey, key);

    return {
      id: `__mini-${key}`,
      type: "line",
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: data.map((row) => Number(row[key]) || 0),
      // Its OWN mirror stack. A second series in "total" would double every
      // key's contribution in the main plot.
      stack: isStacked ? "__mini-total" : undefined,
      smooth: curve.smooth,
      step: curve.step,
      connectNulls: area.connectNulls,
      silent: true,
      showSymbol: false,
      emphasis: { disabled: true },
      tooltip: { show: false },
      lineStyle: {
        color: base,
        width: 1,
        opacity: BRUSH_STROKE_OPACITY * strokeDim,
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: withAlpha(base, BRUSH_FILL_OPACITY * fillDim) },
          { offset: 1, color: withAlpha(base, 0) },
        ]),
      },
      z: 0,
    };
  });

  const dataZoom = buildBrushDataZoom({
    brushBottom,
    brushHeight,
    brushRange: ctx.brushRange,
    fillerColor: withAlpha(tokens.foreground, BRUSH_FILLER_OPACITY),
  });

  return { miniGrid, miniXAxis, miniYAxis, miniSeries, dataZoom };
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ONE grey wave regardless of declared areas (Recharts parity: its skeleton is
 * a single LoadingArea), swept by the shimmer rAF. Unlike the line chart's, this
 * one carries a fill.
 */
export function buildLoadingOption(
  ctx: OptionBuildContext,
  frame: { grid: GridComponentOption; xAxis: XAxisOption; yAxis: YAxisOption },
): EChartsOption {
  const { tokens } = ctx.resolved;
  const curve = curveConfig(ctx.curveType);

  return {
    animation: false,
    grid: frame.grid,
    xAxis: frame.xAxis,
    yAxis: frame.yAxis,
    tooltip: { show: false },
    series: [
      {
        id: "__loading",
        type: "line",
        data: ctx.loadingData(),
        smooth: curve.smooth,
        step: curve.step,
        showSymbol: false,
        silent: true,
        // Invisible until the first shimmer tick positions the clip window.
        lineStyle: { color: withAlpha(tokens.foreground, 0), width: 1 },
        areaStyle: { color: withAlpha(tokens.foreground, 0) },
        z: 1,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Area series — the core builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildAreaSeries(ctx: OptionBuildContext): LineSeriesOption[] {
  const {
    data,
    config,
    areas,
    seriesKeys,
    curveType,
    isStacked,
    isExpanded,
    selectedDataKey,
    hasSelection,
    enableHoverHighlight,
    enableHoverReveal,
    revealIndex,
    revealSink,
    resolved,
    rendererSize,
  } = ctx;

  // Optional per-row normalisation for the expanded (100%) stack.
  const rowTotals = isExpanded
    ? data.map((row) => seriesKeys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0))
    : [];

  return areas.flatMap((area): LineSeriesOption[] => {
    const key = area.dataKey;
    const slots = resolved.series[key] ?? [FALLBACK_SERIES_COLOR];
    const paint = seriesPaint(slots);
    const isSelected = selectedDataKey === key;
    const showUnselected = hasSelection && !isSelected;
    const opacity = getOpacity(selectedDataKey, key);
    const curve = curveConfig(area.curveType ?? curveType);

    const values = data.map((row, i) => {
      const value = Number(row[key]) || 0;
      if (!isExpanded) return value;
      const total = rowTotals[i];
      return total ? value / total : 0;
    });
    const n = values.length;
    const reveal = enableHoverReveal;
    const buffer = !reveal && area.enableBufferLine && n >= 2;
    const revealActive = reveal && revealIndex !== null;

    const restingDot = dotStyle(area.dotVariant, paint, resolved.tokens.background);
    const activeDot = dotStyle(area.activeDotVariant, paint, resolved.tokens.background);
    const restingVisible = area.dotVariant !== "none";
    const dotOpacity = opacity.dot;
    const multiColor = slots.length > 1;

    // The reveal truncates the line to the cursor, which would COMPRESS a
    // bbox-relative stroke gradient into the shorter span — misaligning it from
    // the plot-anchored fill texture and the index-sampled dots.
    const strokePaint =
      reveal && multiColor
        ? new echarts.graphic.LinearGradient(
            8,
            0,
            Math.max(rendererSize.width - 8, 9),
            0,
            slots.map((color, i) => ({ offset: i / (slots.length - 1), color })),
            true,
          )
        : paint;

    const toPoints = (vals: (number | null)[]): AreaPoint[] =>
      !multiColor
        ? vals
        : vals.map((value, i): AreaPoint => {
            if (value === null) return null;
            const t = vals.length > 1 ? i / (vals.length - 1) : 0;
            const pointColor = sampleGradient(slots, t);
            return {
              value,
              itemStyle: {
                ...dotItemStyle(
                  restingVisible ? area.dotVariant : area.activeDotVariant,
                  pointColor,
                  resolved.tokens.background,
                ),
                opacity: dotOpacity,
              },
              emphasis: {
                itemStyle: {
                  ...dotItemStyle(
                    area.activeDotVariant === "none" ? "default" : area.activeDotVariant,
                    pointColor,
                    resolved.tokens.background,
                  ),
                  opacity: 1,
                },
              },
            };
          });

    if (reveal) revealSink[key] = toPoints(values);

    const mainValues: (number | null)[] = buffer
      ? values.map((v, i) => (i === n - 1 ? null : v))
      : revealActive
        ? sliceToNull(values, revealIndex as number)
        : values;

    const mainDash: "solid" | [number, number] =
      buffer || area.strokeVariant === "solid" ? "solid" : ([3, 3] as [number, number]);

    const z = isSelected ? 3 : hasSelection ? 1 : 2;

    const mainSeries: LineSeriesOption = {
      id: key,
      name: typeof config[key]?.label === "string" ? config[key]?.label : key,
      type: "line",
      data: toPoints(mainValues),
      stack: isStacked ? "total" : undefined,
      smooth: curve.smooth,
      step: curve.step,
      connectNulls: area.connectNulls,
      cursor: area.isClickable ? "pointer" : "default",
      // Makes the line AND the filled polygon clickable, like Recharts' <Area>.
      triggerEvent: area.isClickable,
      showSymbol: restingVisible,
      symbol: "circle",
      symbolSize: restingVisible ? restingDot.size : activeDot.size,
      z,
      lineStyle: {
        color: strokePaint,
        width: area.strokeWidth,
        opacity: opacity.stroke,
        type: mainDash,
        dashOffset: 0,
      },
      itemStyle: multiColor
        ? { opacity: dotOpacity }
        : {
            ...(restingVisible ? restingDot.itemStyle : activeDot.itemStyle),
            opacity: dotOpacity,
          },
      areaStyle: {
        color: fillPaint(area.variant, showUnselected, slots, rendererSize),
        opacity: opacity.fill,
      },
      emphasis: {
        focus:
          enableHoverHighlight && !enableHoverReveal && !hasSelection ? "series" : "none",
        scale: restingVisible ? activeDot.size / Math.max(restingDot.size, 1) : 1,
        ...(multiColor ? {} : { itemStyle: { ...activeDot.itemStyle, opacity: 1 } }),
      },
      blur: {
        lineStyle: { opacity: 0.3 },
        areaStyle: { opacity: 0.1 },
        itemStyle: { opacity: 0.3 },
      },
    };

    if (reveal) {
      const muted = resolved.tokens.mutedForeground;
      const revealBase: LineSeriesOption = {
        id: `${REVEAL_PREFIX}${key}`,
        type: "line",
        data: revealActive ? sliceFrom(values, revealIndex as number) : values,
        // Its OWN stack, not "total" — a second series in the real stack would
        // double every key's contribution and break the geometry. This mirror
        // stack reproduces the same cumulative shape in a separate layer.
        stack: isStacked ? "__reveal-total" : undefined,
        smooth: curve.smooth,
        step: curve.step,
        connectNulls: false,
        silent: true,
        showSymbol: false,
        symbol: "circle",
        z: z - 1,
        // Neutral grey, NO fill, SAME dash pattern as the coloured line.
        lineStyle: {
          color: muted,
          width: area.strokeWidth,
          type: mainDash,
          opacity: revealActive ? 0.3 : 0,
        },
        emphasis: { disabled: true },
        blur: { lineStyle: { opacity: revealActive ? 0.3 : 0 } },
        tooltip: { show: false },
      };
      return [revealBase, mainSeries];
    }

    if (!buffer) return [mainSeries];

    const bufferValues: (number | null)[] = values.map((v, i) => (i >= n - 2 ? v : null));

    const bufferSeries: LineSeriesOption = {
      id: `${BUFFER_PREFIX}${key}`,
      type: "line",
      data: toPoints(bufferValues),
      // Own mirror stack — same reasoning as the reveal base.
      stack: isStacked ? "__buffer-total" : undefined,
      smooth: curve.smooth,
      step: curve.step,
      connectNulls: true,
      silent: true,
      showSymbol: restingVisible,
      symbol: "circle",
      symbolSize: restingVisible ? restingDot.size : activeDot.size,
      z,
      lineStyle: {
        color: paint,
        width: area.strokeWidth,
        opacity: opacity.stroke,
        type: BUFFER_DASH,
      },
      itemStyle: multiColor
        ? { opacity: dotOpacity }
        : {
            ...(restingVisible ? restingDot.itemStyle : activeDot.itemStyle),
            opacity: dotOpacity,
          },
      emphasis: {
        focus: "none",
        scale: false,
        lineStyle: { opacity: opacity.stroke },
        itemStyle: { opacity: dotOpacity },
      },
      blur: { lineStyle: { opacity: 0.3 }, itemStyle: { opacity: 0.3 } },
    };

    /**
     * Fill patch. The main area drops its last point so the tail stroke can be
     * the dashed overlay — which also removes the FILL under that segment. This
     * fill-only layer (no stroke, no dots) puts it back, so the area reads as
     * full beneath the dashed tail.
     */
    const bufferFillSeries: LineSeriesOption = {
      id: `${BUFFERFILL_PREFIX}${key}`,
      type: "line",
      data: toPoints(bufferValues),
      stack: isStacked ? "__bufferfill-total" : undefined,
      smooth: curve.smooth,
      step: curve.step,
      connectNulls: true,
      silent: true,
      showSymbol: false,
      z: z - 1,
      lineStyle: { opacity: 0 },
      areaStyle: {
        color: fillPaint(area.variant, showUnselected, slots, rendererSize),
        opacity: opacity.fill,
      },
      emphasis: { disabled: true },
      blur: { areaStyle: { opacity: 0.1 } },
      tooltip: { show: false },
    };

    return [mainSeries, bufferSeries, bufferFillSeries];
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Pointer hit-testing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Each series' PLOTTED top value per index — the cumulative height under a
 * stack, the raw value otherwise. Feeds resolveAreaAtPixel.
 */
export function computePlottedTops(ctx: OptionBuildContext): Record<string, number[]> {
  const { data, areas, seriesKeys, isStacked, isExpanded } = ctx;
  const rowTotals = isExpanded
    ? data.map((row) => seriesKeys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0))
    : [];
  const running: number[] = new Array(data.length).fill(0);
  const tops: Record<string, number[]> = {};

  for (const area of areas) {
    const key = area.dataKey;
    tops[key] = data.map((row, i) => {
      let value = Number(row[key]) || 0;
      if (isExpanded) value = rowTotals[i] ? value / (rowTotals[i] as number) : 0;
      if (!isStacked) return value;
      running[i] = (running[i] ?? 0) + value;
      return running[i] as number;
    });
  }
  return tops;
}

/**
 * Resolves which area the pointer is visually inside.
 *
 * Overlapping area polygons all contain the same pixel, so ECharts' native hit
 * test lands on whichever series drew topmost — not the band the user SEES.
 * A plotted line within grab distance wins outright; otherwise the point
 * belongs to the nearest line ABOVE it (the boundary of the band it is inside).
 *
 * Returns null when the pointer is outside the grid, above every line, or when
 * there is only one series (nothing to disambiguate).
 */
export function resolveAreaAtPixel(
  chart: EChartsInstance,
  tops: Record<string, number[]>,
  keys: string[],
  x: number,
  y: number,
): string | null {
  if (keys.length < 2) return null;
  if (!chart.containPixel({ gridIndex: 0 }, [x, y])) return null;
  const [rawIndex] = chart.convertFromPixel({ gridIndex: 0 }, [x, y]);
  const index = Math.round(rawIndex ?? 0);

  let nearest: string | null = null;
  let nearestDist = Infinity;
  let above: string | null = null;
  let abovePixelY = -Infinity;

  for (const key of keys) {
    const value = tops[key]?.[index];
    if (value === undefined) continue;
    const pixelY = chart.convertToPixel({ gridIndex: 0 }, [index, value])[1];
    if (pixelY === undefined) continue;
    const dist = Math.abs(pixelY - y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = key;
    }
    // Pixel y grows downward: a line above the pointer has the larger pixelY
    // among those ≤ the pointer's.
    if (pixelY <= y && pixelY > abovePixelY) {
      abovePixelY = pixelY;
      above = key;
    }
  }

  return nearestDist <= 10 ? nearest : above;
}
