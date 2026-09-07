/**
 * Composed chart — pure option builders.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-composed-chart.tsx` (MIT).
 */
import { BarChart, LineChart, type BarSeriesOption, type LineSeriesOption } from "echarts/charts";
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
import { barFillPaint } from "./paints";
import {
  AXIS_POINTER_WIDTH,
  BAR_GLOW_BLUR,
  BAR_GLOW_OPACITY,
  BAR_GROW_DURATION,
  BAR_STAGGER,
  BRUSH_FILLER_OPACITY,
  BRUSH_FILL_OPACITY,
  BRUSH_STROKE_OPACITY,
  DASH_PATTERN,
  DEFAULT_BAR_RADIUS,
  GRID_LINE_OPACITY,
  LINE_GLOW_LAYERS,
  LOADING_LINE_WIDTH,
  SELECTION_DIM,
  SELECTION_DIM_FILL,
  STROKE_WIDTH,
  type BarSeriesConfig,
  type ComposedAnimationType,
  type CurveType,
  type LegendSlot,
  type LineSeriesConfig,
  type TooltipSlot,
  type XAxisSlot,
  type YAxisSlot,
} from "./types";

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, DataZoomComponent]);

export type EChartsOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | DataZoomComponentOption
>;

type ArrayItem<T> = T extends readonly (infer U)[] ? U : T;
export type XAxisOption = ArrayItem<NonNullable<EChartsOption["xAxis"]>>;
export type YAxisOption = ArrayItem<NonNullable<EChartsOption["yAxis"]>>;

export type OptionBuildContext = {
  data: Record<string, unknown>[];
  config: ChartConfig;
  bars: BarSeriesConfig[];
  lines: LineSeriesConfig[];
  seriesKeys: string[];
  curveType: CurveType;
  animationType: ComposedAnimationType;
  selectedDataKey: string | null;
  showGrid: boolean;
  xAxisSlot: XAxisSlot;
  yAxisSlot: YAxisSlot;
  tooltipSlot: TooltipSlot;
  legendSlot: LegendSlot;
  isLoading: boolean;
  loadingData: () => number[];
  loadingLineData: () => number[];
  showBrush: boolean;
  brushHeight: number;
  barGap?: number | string;
  barCategoryGap?: number | string;
  resolved: ResolvedColors;
  categories: string[];
  brushRange: BrushRange;
  getHoveredKey: () => string | null;
};

export { curveConfig, getLoadingData };

export function shimmerWindowStops(center: number, color: string, peak: number) {
  return sharedShimmerWindowStops(center, color, peak, withAlpha);
}

// ─────────────────────────────────────────────────────────────────────────────
// Small pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Dim for an unselected series' strokes and dots. */
export function seriesDim(selected: string | null, key: string): number {
  return selected === null || selected === key ? 1 : SELECTION_DIM;
}

/** Dim for an unselected series' FILLS — deeper, since a fill is denser. */
export function seriesFillDim(selected: string | null, key: string): number {
  return selected === null || selected === key ? 1 : SELECTION_DIM_FILL;
}

export function seriesLabel(config: ChartConfig, key: string): string {
  const label = config[key]?.label;
  return typeof label === "string" ? label : key;
}

export function barStaggerDelay(
  type: ComposedAnimationType,
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
    // Bars need to sit BETWEEN ticks, and the lines follow the same axis.
    boundaryGap: true,
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
        // Glow copies, the mini chart and the skeleton are all `__`-prefixed.
        if (String(p.seriesId ?? "").startsWith("__")) return "";
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
      axisPointerColor: withAlpha(tokens.border, 1),
      strokeWidth: AXIS_POINTER_WIDTH,
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
  const { data, bars, lines, curveType, selectedDataKey, brushHeight, categories } = ctx;
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

  // Mirror bars and lines ALIKE as area-lines — the mini chart is a shape
  // summary, not a faithful miniature, so drawing tiny bars there would only
  // add noise. Bars carry no curve, so they take the chart default.
  const miniInputs = [
    ...bars.map((bar) => ({
      dataKey: bar.dataKey,
      curveType: undefined as CurveType | undefined,
      connectNulls: false,
    })),
    ...lines.map((line) => ({
      dataKey: line.dataKey,
      curveType: line.curveType,
      connectNulls: line.connectNulls,
    })),
  ];

  const miniSeries: LineSeriesOption[] = miniInputs.map((input) => {
    const key = input.dataKey;
    const base = (ctx.resolved.series[key] ?? [])[0] ?? FALLBACK_SERIES_COLOR;
    const curve = curveConfig(input.curveType ?? curveType);
    const dim = seriesDim(selectedDataKey, key);
    const fillDim = seriesFillDim(selectedDataKey, key);

    return {
      id: `__mini-${key}`,
      type: "line",
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: data.map((row) => Number(row[key]) || 0),
      smooth: curve.smooth,
      step: curve.step,
      connectNulls: input.connectNulls,
      silent: true,
      showSymbol: false,
      emphasis: { disabled: true },
      tooltip: { show: false },
      lineStyle: { color: base, width: 1, opacity: BRUSH_STROKE_OPACITY * dim },
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
 * A grey bar wave AND a grey line over it, because THIS chart is bars + lines.
 * Both are swept by the SAME diagonal shimmer window: one shared absolute-pixel
 * clip gradient drives the bar fill and the line stroke, so they light up
 * together rather than drifting apart.
 */
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
        itemStyle: {
          color: withAlpha(tokens.foreground, 0),
          borderRadius: [DEFAULT_BAR_RADIUS, DEFAULT_BAR_RADIUS, 0, 0],
        },
        silent: true,
        z: 1,
      },
      {
        id: "__loading-line",
        type: "line",
        data: ctx.loadingLineData(),
        smooth: true,
        showSymbol: false,
        symbol: "none",
        lineStyle: { color: withAlpha(tokens.foreground, 0), width: LOADING_LINE_WIDTH },
        silent: true,
        z: 2,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Series builders
// ─────────────────────────────────────────────────────────────────────────────

export function buildBarSeries(ctx: OptionBuildContext): BarSeriesOption[] {
  const { data, config, bars, animationType, selectedDataKey, resolved, barGap, barCategoryGap } =
    ctx;
  // While a series is click-selected the selection dim owns the canvas — hover
  // highlighting is suspended until it clears.
  const hasSelection = selectedDataKey !== null;

  return bars.map((bar) => {
    const key = bar.dataKey;
    const slots = resolved.series[key] ?? [FALLBACK_SERIES_COLOR];
    const base = slots[0] ?? FALLBACK_SERIES_COLOR;
    const multiColor = slots.length > 1;
    const fillDim = seriesFillDim(selectedDataKey, key);
    const values = data.map((row) => Number(row[key]) || 0);
    const barAnim = bar.animationType ?? animationType;

    // A single-colour bar tints its whole shadow; a multi-colour bar samples the
    // gradient PER DATUM so each column's halo follows the palette at its
    // x-position (one flat tint would be wrong).
    const glowSeriesStyle =
      bar.glow && !multiColor
        ? { shadowBlur: BAR_GLOW_BLUR, shadowColor: withAlpha(base, BAR_GLOW_OPACITY) }
        : {};

    const dataPoints =
      bar.glow && multiColor
        ? values.map((value, i) => {
            const t = values.length > 1 ? i / (values.length - 1) : 0;
            return {
              value,
              itemStyle: {
                shadowBlur: BAR_GLOW_BLUR,
                shadowColor: withAlpha(sampleGradient(slots, t), BAR_GLOW_OPACITY),
              },
            };
          })
        : values;

    const series: BarSeriesOption = {
      id: key,
      name: seriesLabel(config, key),
      type: "bar",
      data: dataPoints,
      barGap,
      barCategoryGap,
      cursor: bar.isClickable ? "pointer" : "default",
      // Bars sit behind lines (z 2 vs 3), matching the Recharts twin's JSX order.
      z: 2,
      itemStyle: {
        color: barFillPaint(bar.variant, slots),
        opacity: fillDim,
        // Stripped bars are square — their solid top strip lives in the fill.
        borderRadius: bar.variant === "stripped" ? 0 : bar.radius,
        ...glowSeriesStyle,
      },
      animationDuration: BAR_GROW_DURATION,
      animationEasing: "cubicOut",
      animationDelay: (idx: number) => barStaggerDelay(barAnim, idx, data.length),
      // `blurScope: "series"` keeps the blur INSIDE this bar, so hovering one
      // column dims its siblings without touching the lines or other bars.
      emphasis:
        bar.enableHoverHighlight && !hasSelection
          ? { focus: "self" as const, blurScope: "series" as const }
          : { focus: "none" as const },
      blur:
        bar.enableHoverHighlight && !hasSelection
          ? { itemStyle: { opacity: SELECTION_DIM_FILL } }
          : undefined,
    };

    return bar.barProps ? { ...series, ...bar.barProps } : series;
  });
}

export function buildLineSeries(ctx: OptionBuildContext): LineSeriesOption[] {
  const { data, config, lines, curveType, selectedDataKey, resolved } = ctx;

  return lines.map((line) => {
    const key = line.dataKey;
    const slots = resolved.series[key] ?? [FALLBACK_SERIES_COLOR];
    const paint = seriesPaint(slots);
    const dim = seriesDim(selectedDataKey, key);
    const curve = curveConfig(line.curveType ?? curveType);
    const values = data.map((row) => Number(row[key]) || 0);

    const restingDot = dotStyle(line.dotVariant, paint, resolved.tokens.background);
    const activeDot = dotStyle(line.activeDotVariant, paint, resolved.tokens.background);
    const restingVisible = line.dotVariant !== "none";
    const multiColor = slots.length > 1;

    const dataPoints = !multiColor
      ? values
      : values.map((value, i) => {
          const t = values.length > 1 ? i / (values.length - 1) : 0;
          const pointColor = sampleGradient(slots, t);
          return {
            value,
            itemStyle: {
              ...dotItemStyle(
                restingVisible ? line.dotVariant : line.activeDotVariant,
                pointColor,
                resolved.tokens.background,
              ),
              opacity: dim,
            },
            emphasis: {
              itemStyle: {
                ...dotItemStyle(
                  line.activeDotVariant === "none" ? "default" : line.activeDotVariant,
                  pointColor,
                  resolved.tokens.background,
                ),
                opacity: 1,
              },
            },
          };
        });

    const series: LineSeriesOption = {
      id: key,
      name: seriesLabel(config, key),
      type: "line",
      data: dataPoints,
      smooth: curve.smooth,
      step: curve.step,
      connectNulls: line.connectNulls,
      cursor: line.isClickable ? "pointer" : "default",
      triggerEvent: line.isClickable,
      showSymbol: restingVisible,
      symbol: "circle",
      symbolSize: restingVisible ? restingDot.size : activeDot.size,
      z: 3,
      // The glow is NOT a shadowBlur here — a single shadowColor can't follow the
      // horizontal gradient. buildLineGlowSeries stacks overlay copies instead.
      lineStyle: {
        color: paint,
        width: STROKE_WIDTH,
        opacity: dim,
        type: line.strokeVariant === "solid" ? "solid" : DASH_PATTERN,
        dashOffset: 0,
      },
      itemStyle: multiColor
        ? { opacity: dim }
        : {
            ...(restingVisible ? restingDot.itemStyle : activeDot.itemStyle),
            opacity: dim,
          },
      emphasis: {
        focus: "none",
        scale: restingVisible ? activeDot.size / Math.max(restingDot.size, 1) : 1,
        ...(multiColor ? {} : { itemStyle: { ...activeDot.itemStyle, opacity: 1 } }),
      },
    };

    return line.lineProps ? { ...series, ...line.lineProps } : series;
  });
}

/**
 * Glow overlay copies for glowing LINES — silent, symbol-less copies painted
 * with the same gradient as the real stroke, stacked under it.
 *
 * These come AFTER the main series in the option array (their z keeps them
 * visually under the lines and over the bars) so the seriesIndex → key map used
 * for clicks stays intact.
 */
export function buildLineGlowSeries(ctx: OptionBuildContext): LineSeriesOption[] {
  const { data, lines, curveType, selectedDataKey, resolved } = ctx;

  return lines
    .filter((line) => line.glow)
    .flatMap((line) => {
      const key = line.dataKey;
      const slots = resolved.series[key] ?? [FALLBACK_SERIES_COLOR];
      const paint = seriesPaint(slots);
      const dim = seriesDim(selectedDataKey, key);
      const curve = curveConfig(line.curveType ?? curveType);
      const values = data.map((row) => Number(row[key]) || 0);

      // Widest (faintest) first, so it paints beneath the tighter layers.
      return [...LINE_GLOW_LAYERS].reverse().map(
        (layer, i): LineSeriesOption => ({
          id: `__glow-${key}-${i}`,
          type: "line",
          data: values,
          smooth: curve.smooth,
          step: curve.step,
          connectNulls: line.connectNulls,
          silent: true,
          showSymbol: false,
          symbol: "none",
          emphasis: { disabled: true },
          tooltip: { show: false },
          // Above the bars (z 2), below the crisp line (z 3).
          z: 2,
          lineStyle: {
            color: paint,
            width: layer.width,
            opacity: layer.opacity * dim,
            shadowBlur: layer.blur,
            // Full-alpha colour: the element opacity above already scales its
            // shadow, so pre-dimming here would square the alpha.
            shadowColor: sampleGradient(slots, 0.5),
            cap: "round",
            join: "round",
          },
        }),
      );
    });
}
