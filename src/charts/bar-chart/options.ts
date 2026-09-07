/**
 * Bar chart — pure option builders, plus the two live-coordinate measurements
 * the variants depend on.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-bar-chart.tsx` (MIT).
 */
import { BarChart, type BarSeriesOption } from "echarts/charts";
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

import { getLoadingData, shimmerWindowStops as sharedShimmerWindowStops } from "../../lib/chart-series";
import {
  FALLBACK_SERIES_COLOR,
  flattenColor,
  getColorsCount,
  withAlpha,
  type ChartConfig,
  type ResolvedColors,
} from "../../lib/chart-tokens";
import { buildBrushDataZoom, type BrushRange } from "../../lib/echarts-brush";
import { sampleGradient } from "../../lib/echarts-dot";
import {
  tooltipBaseOption,
  tooltipIndicatorHtml,
  tooltipRow,
  tooltipShell,
} from "../../lib/echarts-tooltip";
import {
  barBorderRadius,
  barFillPaint,
  expandableDatumPaint,
  patternFill,
  strippedCapFraction,
  strippedDatumPaint,
} from "./paints";
import {
  BAR_GROW_DURATION,
  BAR_STAGGER,
  BLOCK_SIZE,
  BLOCK_TRACK_OPACITY,
  BRUSH_FILLER_OPACITY,
  BRUSH_FILL_OPACITY,
  DEFAULT_BAR_RADIUS,
  EXPAND_COLLAPSED,
  GLOW_BLUR,
  GLOW_OPACITY,
  GRID_LINE_OPACITY,
  HOVER_BLUR,
  MAX_HIGHLIGHT_DIM,
  SELECTION_DIM,
  STACK_SEGMENT_GAP,
  STROKE_WIDTH,
  type AxisSlot,
  type BarAnimationType,
  type BarSeriesConfig,
  type LegendSlot,
  type TooltipSlot,
} from "./types";

echarts.use([BarChart, GridComponent, TooltipComponent, DataZoomComponent]);

export type EChartsOption = ComposeOption<
  | BarSeriesOption
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
  bars: BarSeriesConfig[];
  seriesKeys: string[];
  animationType: BarAnimationType;
  barRadius: number;
  isHorizontal: boolean;
  isStacked: boolean;
  isPercent: boolean;
  selectedDataKey: string | null;
  hasSelection: boolean;
  showGrid: boolean;
  /** Category axis is x (vertical layout) or y (horizontal); value axis the other. */
  categorySlot: AxisSlot;
  valueSlot: AxisSlot;
  tooltipSlot: TooltipSlot;
  legendSlot: LegendSlot;
  isLoading: boolean;
  loadingData: () => number[];
  showBrush: boolean;
  brushHeight: number;
  barGap?: number;
  barCategoryGap?: number;
  resolved: ResolvedColors;
  categories: string[];
  brushRange: BrushRange;
  /** Measured value-axis pixels-per-unit; null before first layout. */
  valuePxPerUnit: number | null;
  /** Measured bar width — sizes the blocks variant's squares; null pre-layout. */
  barWidthPx: number | null;
  /** Openness per bar index for the expandable variant, plus which one is hovered. */
  expand: { key: string | null; hovered: number | null; progress: Map<number, number> };
  /** Column to keep coloured under enableMaxValueHighlight. */
  maxHighlightIndex: number | null;
  getHoveredKey: () => string | null;
};

export { getLoadingData };

/** shimmerWindowStops with this repo's withAlpha bound in. */
export function shimmerWindowStops(center: number, color: string, peak: number) {
  return sharedShimmerWindowStops(center, color, peak, withAlpha);
}

/** Skeleton bars as a smooth random walk — reuses the shared generator. */
export function getLoadingBarData(bars: number): number[] {
  return getLoadingData(bars);
}

// ─────────────────────────────────────────────────────────────────────────────
// Live-coordinate measurements
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pixels per one value-axis unit, read straight off the live coordinate system.
 *
 * Returns null before the first layout. Turns the stripped cap's fixed pixel
 * height into a per-bar gradient fraction, so the cap stays constant as the
 * value axis rescales on resize or zoom.
 */
export function measureValuePxPerUnit(
  chart: EChartsInstance,
  isHorizontal: boolean,
): number | null {
  const finder = isHorizontal ? { xAxisIndex: 0 } : { yAxisIndex: 0 };
  // convertToPixel throws before the first setOption (no coordinate system yet)
  // and whenever the value axis isn't laid out — any failure means "not
  // measurable", not an error.
  try {
    const p0 = chart.convertToPixel(finder, 0);
    const p1 = chart.convertToPixel(finder, 1);
    if (typeof p0 !== "number" || typeof p1 !== "number") return null;
    const delta = Math.abs(p1 - p0);
    return Number.isFinite(delta) && delta > 0 ? delta : null;
  } catch {
    return null;
  }
}

/**
 * Measures the rendered width of one bar, so the `blocks` variant can make its
 * segments square — their width IS the bar width, and only layout knows it.
 *
 * The category pitch comes from the axis; the bar occupies that minus the
 * category gap (a px number when the consumer set one, else ECharts' own 20%).
 */
export function measureBarWidthPx(
  chart: EChartsInstance,
  isHorizontal: boolean,
  barCategoryGap: number | undefined,
): number | null {
  const finder = isHorizontal ? { yAxisIndex: 0 } : { xAxisIndex: 0 };
  try {
    const p0 = chart.convertToPixel(finder, 0);
    const p1 = chart.convertToPixel(finder, 1);
    if (typeof p0 !== "number" || typeof p1 !== "number") return null;
    const pitch = Math.abs(p1 - p0);
    if (!Number.isFinite(pitch) || pitch <= 0) return null;
    const width = barCategoryGap != null ? pitch - barCategoryGap : pitch * 0.8;
    return width > 1 ? width : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Selection + entrance helpers
// ─────────────────────────────────────────────────────────────────────────────

/** A bar dims only when a DIFFERENT series is selected. */
export function selectionOpacity(selected: string | null, key: string): number {
  return selected === null || selected === key ? 1 : SELECTION_DIM;
}

/**
 * How many stagger steps a bar at `index` waits before it grows in.
 *
 * Bars are independent rectangles, so unlike the area chart's single
 * left-to-right clip, the direction values are honoured here via a per-datum
 * `animationDelay`.
 */
export function barStaggerDelay(
  type: BarAnimationType,
  index: number,
  count: number,
): number {
  if (type === "none" || count <= 0) return 0;
  const last = count - 1;
  const center = last / 2;
  let step: number;
  switch (type) {
    case "right-to-left":
      step = last - index;
      break;
    case "center-out":
      step = Math.abs(index - center);
      break;
    case "edges-in":
      step = center - Math.abs(index - center);
      break;
    default:
      step = index;
  }
  return step * BAR_STAGGER;
}

/** The tallest COLUMN, comparing totals across every series. */
export function findMaxColumnIndex(
  data: Record<string, unknown>[],
  seriesKeys: string[],
): number | null {
  if (!data.length || !seriesKeys.length) return null;
  let best = 0;
  let bestTotal = -Infinity;
  data.forEach((row, i) => {
    const total = seriesKeys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
    if (total > bestTotal) {
      bestTotal = total;
      best = i;
    }
  });
  return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout + axes
// ─────────────────────────────────────────────────────────────────────────────

export function buildChartLayout(ctx: OptionBuildContext): {
  grid: GridComponentOption;
  brushBottom: number;
} {
  const { legendSlot, showBrush, brushHeight } = ctx;
  const legendTop = legendSlot.present && legendSlot.verticalAlign === "top";
  const legendBottom = legendSlot.present && legendSlot.verticalAlign === "bottom";
  const brushGap = showBrush ? brushHeight + 30 : 0;

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
  const {
    isHorizontal,
    showGrid,
    isLoading,
    isPercent,
    categories,
    loadingData,
    categorySlot,
    valueSlot,
  } = ctx;
  const { tokens } = ctx.resolved;

  const axisLabelColor = tokens.mutedForeground;
  const splitLineColor = withAlpha(tokens.border, GRID_LINE_OPACITY);
  const tickDotColor = flattenColor(splitLineColor, tokens.background);
  const catData = isLoading ? loadingData().map((_, i) => i) : categories;
  const catFormatter = categorySlot.tickFormatter;
  const valFormatter = valueSlot.tickFormatter;

  // The axis TITLE follows the axis PART, not its category/value role, so
  // nameGap swaps with the layout alongside the label styling.
  const categoryNameGap = isHorizontal ? 38 : 30;
  const valueNameGap = isHorizontal ? 30 : 38;

  // Left un-annotated so the inferred type stays free of an axis-specific
  // `position`: the layout swap assigns the category axis to y for horizontal
  // bars, and XAxisOption / YAxisOption disagree on `position`.
  const categoryAxis = {
    type: "category" as const,
    // Bars sit BETWEEN ticks — the opposite of the area chart's boundaryGap.
    boundaryGap: true,
    show: true,
    // Recharts' YAxis lists its first category at the TOP; ECharts' y category
    // axis defaults to bottom-up, so flip it when the category axis is on y.
    inverse: isHorizontal,
    data: catData,
    name: isLoading ? undefined : categorySlot.label,
    nameLocation: "middle" as const,
    nameGap: categoryNameGap,
    nameTextStyle: { color: axisLabelColor, fontSize: 10 },
    axisLine: { show: false },
    axisTick: {
      show: !isLoading && categorySlot.present && !categorySlot.hideDots,
      length: 0.5,
      // Bars use boundaryGap, so ECharts would otherwise drop each tick on the
      // BOUNDARY between categories — a dot floating between labels.
      alignWithLabel: true,
      lineStyle: { color: tickDotColor, width: 3, cap: "round" as const },
    },
    splitLine: { show: false },
    axisLabel: {
      show: !isLoading && categorySlot.present,
      color: axisLabelColor,
      fontSize: 10,
      margin: 8,
      formatter: catFormatter
        ? (value: string, index: number) => catFormatter(value, index)
        : undefined,
    },
  };

  const valueAxis = {
    type: "value" as const,
    show: valueSlot.present || showGrid,
    max: isPercent ? 1 : undefined,
    name: isLoading ? undefined : valueSlot.label,
    nameLocation: "middle" as const,
    nameGap: valueNameGap,
    nameTextStyle: { color: axisLabelColor, fontSize: 10 },
    axisLine: { show: false },
    axisTick: {
      show: valueSlot.present && !isLoading && !valueSlot.hideDots,
      length: 0.5,
      lineStyle: { color: tickDotColor, width: 3, cap: "round" as const },
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
      show: valueSlot.present && !isLoading,
      color: axisLabelColor,
      fontSize: 10,
      margin: 8,
      formatter: isPercent
        ? (value: number) => `${Math.round(value * 100)}%`
        : valFormatter
          ? (value: number, index: number) => valFormatter(String(value), index)
          : undefined,
    },
  };

  return isHorizontal
    ? { xAxis: valueAxis, yAxis: categoryAxis }
    : { xAxis: categoryAxis, yAxis: valueAxis };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────────────────────

export function createTooltipFormatter(ctx: OptionBuildContext) {
  const { config, selectedDataKey, tooltipSlot, getHoveredKey, isPercent } = ctx;

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
        // Stack spacers, the mini chart and the skeleton are all `__`-prefixed.
        if (rawId.startsWith("__")) return "";
        const key = p.seriesId ?? p.seriesName ?? "";
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
          typeof p.value === "number"
            ? isPercent
              ? `${Math.round(p.value * 100)}%`
              : p.value.toLocaleString()
            : String(p.value ?? "");

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
      // Bars use a shadow axis-pointer rather than a cursor line.
      cursor: false,
      tokens,
      position: tooltipSlot.position,
      axisPointerColor: "transparent",
      strokeWidth: STROKE_WIDTH,
    }),
    // A translucent column behind the hovered category reads better on bars than
    // the line chart's dashed cursor.
    axisPointer: { type: "shadow", shadowStyle: { color: withAlpha(tokens.border, 0.4) } },
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
  miniSeries: BarSeriesOption[];
  dataZoom: DataZoomComponentOption[];
} {
  const { data, bars, isStacked, selectedDataKey, hasSelection, brushHeight, categories } =
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
    boundaryGap: true,
    show: false,
    data: categories,
    axisPointer: { show: false },
  };

  const miniYAxis: YAxisOption = { type: "value", gridIndex: 1, show: false };

  const miniSeries: BarSeriesOption[] = bars.map((bar) => {
    const key = bar.dataKey;
    const base = (ctx.resolved.series[key] ?? [])[0] ?? FALLBACK_SERIES_COLOR;
    const dim = hasSelection && selectedDataKey !== key ? SELECTION_DIM : 1;

    return {
      id: `__mini-${key}`,
      type: "bar",
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: data.map((row) => Number(row[key]) || 0),
      stack: isStacked ? "__mini-total" : undefined,
      silent: true,
      barCategoryGap: "20%",
      emphasis: { disabled: true },
      tooltip: { show: false },
      itemStyle: { color: base, opacity: BRUSH_FILL_OPACITY * dim, borderRadius: 1 },
      z: 0,
      animation: false,
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

export function buildLoadingOption(
  ctx: OptionBuildContext,
  frame: { grid: GridComponentOption; xAxis: XAxisOption; yAxis: YAxisOption },
): EChartsOption {
  const { tokens } = ctx.resolved;

  return {
    animation: false,
    grid: frame.grid,
    xAxis: frame.xAxis,
    yAxis: frame.yAxis,
    tooltip: { show: false },
    series: [
      {
        id: "__loading",
        type: "bar",
        data: ctx.loadingData(),
        barCategoryGap: "30%",
        silent: true,
        // Invisible until the first shimmer tick positions the clip window.
        itemStyle: {
          color: withAlpha(tokens.foreground, 0),
          borderRadius: barBorderRadius(DEFAULT_BAR_RADIUS, "default", ctx.isHorizontal),
        },
        z: 1,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar series — the core builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildBarSeries(ctx: OptionBuildContext): BarSeriesOption[] {
  const {
    data,
    config,
    bars,
    seriesKeys,
    animationType,
    isHorizontal,
    isStacked,
    isPercent,
    selectedDataKey,
    hasSelection,
    barGap,
    barCategoryGap,
    resolved,
  } = ctx;

  const lastIndex = data.length - 1;

  const rowTotals = isPercent
    ? data.map((row) => seriesKeys.reduce((sum, key) => sum + (Number(row[key]) || 0), 0))
    : [];

  const series: BarSeriesOption[] = bars.map((bar) => {
    const key = bar.dataKey;
    const slots = resolved.series[key] ?? [FALLBACK_SERIES_COLOR];
    const base = slots[0] ?? FALLBACK_SERIES_COLOR;
    const isSelected = selectedDataKey === key;
    const dim = selectionOpacity(selectedDataKey, key);
    const resolvedRadius = bar.radius ?? ctx.barRadius;
    const borderRadius = barBorderRadius(resolvedRadius, bar.variant, isHorizontal);
    // Square segments: the tile's height matches the measured bar width, so each
    // block is 1:1. Falls back to BLOCK_SIZE on the first push, before layout.
    const blockSize = ctx.barWidthPx ?? BLOCK_SIZE;
    const fill = barFillPaint(bar.variant, slots, isHorizontal, blockSize);
    const barAnim = bar.animationType ?? animationType;
    const isStripped = bar.variant === "stripped";
    const isExpandable = bar.variant === "expandable";
    const mutedFill = withAlpha(resolved.tokens.mutedForeground, MAX_HIGHLIGHT_DIM);
    const isMuted = (i: number) =>
      ctx.maxHighlightIndex != null && i !== ctx.maxHighlightIndex;

    // Openness per datum, driven by the hover rAF. Bars not in the map are shut.
    const expandOf = (i: number) =>
      ctx.expand.key === key
        ? (ctx.expand.progress.get(i) ?? EXPAND_COLLAPSED)
        : EXPAND_COLLAPSED;
    const expandHovered = ctx.expand.key === key ? ctx.expand.hovered : null;

    // The unfilled part of a blocks bar: the same tile in a muted tone, drawn by
    // ECharts' own bar background so it spans the column's full height.
    const isBlocks = bar.variant === "blocks";
    const blockTrack = isBlocks
      ? patternFill(
          "blocks",
          withAlpha(resolved.tokens.mutedForeground, BLOCK_TRACK_OPACITY),
          blockSize,
        )
      : null;

    const values = data.map((row, i) => {
      const value = Number(row[key]) || 0;
      if (!isPercent) return value;
      const total = rowTotals[i];
      return total ? value / total : 0;
    });

    // Buffer bar: the last datum becomes a bare hatched rectangle with a
    // series-coloured outline, marking projected/incomplete data.
    const bufferStyle = bar.bufferBar
      ? {
          color: patternFill("buffer", base) ?? "transparent",
          borderColor: base,
          borderWidth: STROKE_WIDTH,
          borderRadius,
        }
      : null;

    /**
     * Per-bar glow. The shadowColor is sampled from the series gradient at each
     * bar's position, so a multi-stop series glows in its own colours across the
     * plot instead of one flat tint. A canvas shape carries only one shadow, so
     * the sample is per bar, not within a bar.
     */
    const glowAt = (i: number) => ({
      shadowBlur: GLOW_BLUR,
      shadowColor: withAlpha(
        sampleGradient(slots, values.length > 1 ? i / (values.length - 1) : 0),
        GLOW_OPACITY,
      ),
    });
    // `glowing` haloes every bar; enableMaxValueHighlight haloes only the winner
    // — the muted ones must stay flat or the "one bar stands out" reading breaks.
    const glowFor = bar.glowing
      ? glowAt
      : ctx.maxHighlightIndex != null
        ? (i: number) => (i === ctx.maxHighlightIndex ? glowAt(i) : {})
        : null;

    // Only wrap a datum in an object when it needs per-point overrides;
    // otherwise keep the bare number so the series itemStyle applies untouched.
    const dataPoints =
      isStripped ||
      isExpandable ||
      glowFor ||
      ctx.maxHighlightIndex != null ||
      (bufferStyle && lastIndex >= 0)
        ? values.map((value, i) => {
            const isBuffer = !!bufferStyle && i === lastIndex;
            if (!isBuffer && !glowFor && !isStripped && !isExpandable && !isMuted(i)) {
              return value;
            }
            return {
              value,
              ...(isExpandable ? { label: { show: i === expandHovered } } : {}),
              itemStyle: {
                ...(isStripped && !isBuffer
                  ? {
                      color: strippedDatumPaint(
                        slots,
                        isHorizontal,
                        strippedCapFraction(value, ctx.valuePxPerUnit),
                      ),
                    }
                  : {}),
                ...(isExpandable && !isBuffer
                  ? { color: expandableDatumPaint(slots, expandOf(i)) }
                  : {}),
                ...(isBuffer && bufferStyle ? bufferStyle : {}),
                ...(glowFor ? glowFor(i) : {}),
                // Last, so it overrides the variant's own paint.
                ...(isMuted(i) ? { color: mutedFill } : {}),
              },
            };
          })
        : values;

    return {
      id: key,
      name: typeof config[key]?.label === "string" ? config[key]?.label : key,
      type: "bar",
      data: dataPoints,
      stack: isStacked ? "total" : undefined,
      barGap,
      barCategoryGap,
      cursor: bar.isClickable ? "pointer" : "default",
      z: isSelected ? 3 : hasSelection ? 1 : 2,
      // The hovered expandable bar names its value above itself.
      label: isExpandable
        ? {
            show: false,
            position: "top" as const,
            color: resolved.tokens.foreground,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 11,
          }
        : undefined,
      showBackground: isBlocks,
      backgroundStyle: blockTrack ? { color: blockTrack, borderRadius } : undefined,
      itemStyle: {
        color: fill,
        borderRadius,
        opacity: dim,
        // The glow lives on each datum's itemStyle — a single series-level
        // shadowColor can't follow a gradient.
      },
      // A click-selection OWNS the dim while active, so hover highlighting
      // switches off entirely whenever a selection exists and resumes after.
      emphasis:
        bar.enableHoverHighlight && !hasSelection
          ? { focus: "self" as const, blurScope: "coordinateSystem" as const }
          : { disabled: true },
      blur:
        bar.enableHoverHighlight && !hasSelection
          ? { itemStyle: { opacity: HOVER_BLUR } }
          : undefined,
      // The grow-in envelope. Only takes effect on the reveal push; every later
      // push sends `animation: false`, so the stagger is dormant then.
      animationDuration: BAR_GROW_DURATION,
      animationEasing: "cubicOut" as const,
      animationDelay: (idx: number) => barStaggerDelay(barAnim, idx, data.length),
    };
  });

  /**
   * Stacked segments butt together into one solid column, so part them with a
   * REAL gap: a transparent series stacked between each adjacent pair.
   *
   * The spacer's value is in DATA units, derived from the measured
   * pixels-per-unit to keep the gap a constant pixel height whatever the scale.
   * Before first layout that measurement is null and the gap is skipped; the
   * post-layout re-push applies it in the same frame.
   */
  const gapUnits =
    (isStacked || isPercent) && series.length > 1 && ctx.valuePxPerUnit
      ? STACK_SEGMENT_GAP / ctx.valuePxPerUnit
      : 0;
  if (!gapUnits) return series;

  const spaced: BarSeriesOption[] = [];
  series.forEach((entry, i) => {
    spaced.push(entry);
    if (i === series.length - 1) return;
    spaced.push({
      id: `__stackgap-${i}`,
      type: "bar",
      stack: isStacked ? "total" : undefined,
      data: data.map(() => gapUnits),
      itemStyle: { color: "transparent" },
      silent: true,
      tooltip: { show: false },
      legendHoverLink: false,
      emphasis: { disabled: true },
      animation: false,
      z: 1,
    });
  });
  return spaced;
}
