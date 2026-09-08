import { BarChart, type BarSeriesOption } from "echarts/charts";
import {
  PolarComponent,
  TooltipComponent,
  type PolarComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";

import {
  getLoadingData as sharedGetLoadingData,
  shimmerWindowStops as sharedShimmerWindowStops,
} from "../../lib/chart-series";
import {
  FALLBACK_SERIES_COLOR,
  getColorsCount,
  withAlpha,
  type ChartConfig,
  type ResolvedColors,
} from "../../lib/chart-tokens";
import {
  resolveTooltipPosition,
  roundnessClass,
  tooltipIndicatorHtml,
  tooltipRow,
  tooltipVariantClass,
} from "../../lib/echarts-tooltip";
import {
  LOADING_BARS,
  LOADING_MAX,
  LOADING_SERIES_ID,
  LOADING_TRACK_ID,
  MAIN_SERIES_ID,
  SELECTED_DIM_OPACITY,
  TRACK_OPACITY,
  TRACK_POLAR_INDEX,
  TRACK_SERIES_ID,
  type BarItemStyle,
  type RadialBarSlot,
  type RadialVariant,
  type TooltipSlot,
} from "./types";

/**
 * Radial chart — pure option builders.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-radial-chart.tsx` (MIT).
 */

echarts.use([BarChart, PolarComponent, TooltipComponent]);

export type EChartsOption = ComposeOption<
  BarSeriesOption | PolarComponentOption | TooltipComponentOption
>;

type ArrayItem<T> = T extends readonly (infer U)[] ? U : T;
export type PolarOption = ArrayItem<NonNullable<EChartsOption["polar"]>>;
export type AngleAxisOption = ArrayItem<NonNullable<EChartsOption["angleAxis"]>>;
export type RadiusAxisOption = ArrayItem<NonNullable<EChartsOption["radiusAxis"]>>;

export type OptionBuildContext = {
  config: ChartConfig;
  categories: string[];
  values: number[];
  radialBar: RadialBarSlot;
  variant: RadialVariant;
  innerRadius: number | string;
  outerRadius: number | string;
  angleMax: number;
  selectedBar: string | null;
  hasSelection: boolean;
  tooltipSlot: TooltipSlot;
  isLoading: boolean;
  loadingData: () => number[];
  resolved: ResolvedColors;
};

export function shimmerWindowStops(center: number, color: string, peak: number) {
  return sharedShimmerWindowStops(center, color, peak, withAlpha);
}

/** Skeleton ring values — a smooth walk in a 40–100 band. */
export function getLoadingData(count: number): number[] {
  const rows: number[] = [];
  let value = 55 + Math.random() * 30;
  for (let i = 0; i < count; i++) {
    value = Math.min(LOADING_MAX, Math.max(40, value + (Math.random() - 0.5) * 30));
    rows.push(Math.round(value));
  }
  return rows;
}

export { sharedGetLoadingData };

// ─────────────────────────────────────────────────────────────────────────────
// Geometry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arc shape per variant.
 *
 * `full` starts at 12 o'clock and sweeps a whole turn. `semi` is a half circle
 * sitting on its diameter, so its centre drops to 70% to keep the arc visually
 * centred in the box rather than floating in the upper half.
 */
export function getVariantGeometry(variant: RadialVariant): {
  center: [string, string];
  startAngle: number;
  endAngle: number;
} {
  switch (variant) {
    case "semi":
      return { center: ["50%", "70%"], startAngle: 180, endAngle: 0 };
    case "full":
    default:
      return { center: ["50%", "50%"], startAngle: 90, endAngle: -270 };
  }
}

/**
 * Rounds up to a "nice" ceiling (1, 2 or 5 × a power of ten) so the largest ring
 * stops just shy of a full wrap rather than exactly on it.
 */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const rough = value / 5;
  const power = Math.floor(Math.log10(rough));
  const base = Math.pow(10, power);
  const fraction = rough / base;
  const niceFraction = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  const interval = niceFraction * base;
  return Math.ceil(value / interval) * interval;
}

/**
 * TWO identical polars.
 *
 * The track can't share polar 0 with the data rings: bars on one polar share a
 * category band, so a second series there would halve every ring's thickness and
 * offset it. Giving the track its own polar means both draw at full width on the
 * same radius.
 */
export function buildPolar(ctx: OptionBuildContext): PolarOption[] {
  const geom = getVariantGeometry(ctx.variant);
  const polar: PolarOption = {
    center: geom.center,
    radius: [ctx.innerRadius, ctx.outerRadius] as (number | string)[],
  };
  return [polar, { ...polar }];
}

export function buildAngleAxis(ctx: OptionBuildContext): AngleAxisOption[] {
  const geom = getVariantGeometry(ctx.variant);
  const axis: AngleAxisOption = {
    type: "value",
    min: 0,
    max: ctx.angleMax,
    startAngle: geom.startAngle,
    endAngle: geom.endAngle,
    clockwise: true,
    show: false,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { show: false },
    splitLine: { show: false },
  };
  // One per polar — an axis binds to its system through `polarIndex`.
  return [
    { ...axis, polarIndex: 0 },
    { ...axis, polarIndex: TRACK_POLAR_INDEX },
  ];
}

export function buildRadiusAxis(ctx: OptionBuildContext): RadiusAxisOption[] {
  const axis: RadiusAxisOption = {
    type: "category",
    data: ctx.categories,
    show: false,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { show: false },
    splitLine: { show: false },
  };
  // Identical bands on both polars, so a ring and its track land on the same radius.
  return [
    { ...axis, polarIndex: 0 },
    { ...axis, polarIndex: TRACK_POLAR_INDEX },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Series
// ─────────────────────────────────────────────────────────────────────────────

/** Multi-colour rings run their gradient diagonally, like the pie's sectors. */
export function barPaint(slots: string[]): string | echarts.graphic.LinearGradient {
  if (slots.length <= 1) return slots[0] ?? FALLBACK_SERIES_COLOR;
  const stops = slots.map((color, i) => ({ offset: i / (slots.length - 1), color }));
  return new echarts.graphic.LinearGradient(0, 0, 1, 1, stops);
}

/** The unfilled ring behind each bar — a full-extent bar on the second polar. */
export function buildTrackSeries(
  ctx: OptionBuildContext,
  loading: boolean,
): BarSeriesOption {
  const { radialBar } = ctx;
  const trackColor = withAlpha(ctx.resolved.tokens.mutedForeground, TRACK_OPACITY);

  return {
    id: loading ? LOADING_TRACK_ID : TRACK_SERIES_ID,
    type: "bar",
    coordinateSystem: "polar",
    polarIndex: TRACK_POLAR_INDEX,
    data: ctx.categories.map(() => ctx.angleMax),
    barWidth: radialBar.barSize,
    roundCap: radialBar.cornerRadius > 0,
    silent: true,
    // Static: the track is there from the first frame; only the data rings sweep
    // in (Recharts parity — its background sectors don't animate).
    animation: false,
    emphasis: { disabled: true },
    itemStyle: { color: trackColor },
    z: 1,
  };
}

export function buildBarSeries(ctx: OptionBuildContext): BarSeriesOption[] {
  const { categories, values, radialBar, selectedBar, hasSelection, resolved } = ctx;

  const data = categories.map((name, i) => {
    const slots = resolved.series[name] ?? [FALLBACK_SERIES_COLOR];
    const isSelected = selectedBar === null || selectedBar === name;
    // Selection only dims when the bar is actually clickable (Recharts twin).
    const dimmed = radialBar.isClickable && hasSelection && !isSelected;

    const itemStyle: BarItemStyle = {
      color: barPaint(slots),
      opacity: dimmed ? SELECTED_DIM_OPACITY : 1,
    };

    return { value: values[i] ?? 0, itemStyle };
  });

  const main: BarSeriesOption = {
    id: MAIN_SERIES_ID,
    type: "bar",
    coordinateSystem: "polar",
    // Sole series on polar 0 — the track rides its own (see buildTrackSeries).
    polarIndex: 0,
    data,
    barWidth: radialBar.barSize,
    roundCap: radialBar.cornerRadius > 0,
    cursor: radialBar.isClickable ? "pointer" : "default",
    // The radial twin has no hover-highlight, so bars don't emphasise on hover.
    emphasis: { disabled: true },
    z: 3, // above the track (z 1)
  };

  // Main FIRST so `showTip` can target it by a stable index; z keeps it above
  // the track regardless of array order.
  return [main, ...(radialBar.showBackground ? [buildTrackSeries(ctx, false)] : [])];
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────────────────────

export function createTooltipFormatter(ctx: OptionBuildContext) {
  const { config, categories, tooltipSlot } = ctx;

  return (params: unknown): string => {
    const p = (Array.isArray(params) ? params[0] : params) as {
      dataIndex?: number;
      value?: number | string;
      seriesId?: string;
    } | null;
    if (p == null || String(p.seriesId ?? "").startsWith("__")) return "";

    const index = typeof p.dataIndex === "number" ? p.dataIndex : 0;
    const key = categories[index] ?? "";
    const item = config[key];
    const colorsCount = item ? getColorsCount(item) : 1;
    const labelText = typeof item?.label === "string" ? item.label : key;
    const value =
      typeof p.value === "number" ? p.value.toLocaleString() : String(p.value ?? "");

    // Item-triggered, one ring per hover, no separate header row — so the shared
    // tooltipShell (which always renders a label div) is intentionally not used.
    const row = tooltipRow({
      indicatorHtml: tooltipIndicatorHtml(key, colorsCount),
      labelText,
      valueText: value,
      dimmed: "",
    });

    return `<div class="grid min-w-32 items-start gap-1.5 border border-border/50 px-2.5 py-1.5 text-xs shadow-xl ${roundnessClass[tooltipSlot.roundness]} ${tooltipVariantClass[tooltipSlot.variant]}">
      <div class="grid gap-1.5">${row}</div>
    </div>`;
  };
}

export function buildTooltipOption(ctx: OptionBuildContext): TooltipComponentOption {
  const { tooltipSlot, isLoading } = ctx;

  return {
    show: tooltipSlot.present && !isLoading,
    trigger: "item",
    confine: true,
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
    extraCssText: "box-shadow:none;",
    position: resolveTooltipPosition(tooltipSlot.position),
    formatter: createTooltipFormatter(ctx),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A faint set of full rings (the always-visible track) with a bright band
 * CLIPPED to a sweeping window on top. One grey skeleton regardless of the real
 * data, matching the cartesian charts' approach.
 */
export function buildLoadingOption(ctx: OptionBuildContext): EChartsOption {
  const { tokens } = ctx.resolved;
  const loadingCats = Array.from({ length: LOADING_BARS }, (_, i) => String(i));
  const loadingCtx: OptionBuildContext = {
    ...ctx,
    categories: loadingCats,
    angleMax: LOADING_MAX,
  };

  return {
    animation: false,
    polar: buildPolar(loadingCtx),
    angleAxis: buildAngleAxis(loadingCtx),
    radiusAxis: buildRadiusAxis(loadingCtx),
    tooltip: { show: false },
    series: [
      buildTrackSeries(loadingCtx, true),
      {
        id: LOADING_SERIES_ID,
        type: "bar",
        coordinateSystem: "polar",
        polarIndex: 0,
        data: ctx.loadingData(),
        barWidth: loadingCtx.radialBar.barSize,
        roundCap: loadingCtx.radialBar.cornerRadius > 0,
        silent: true,
        emphasis: { disabled: true },
        // Invisible until the first shimmer tick positions the clip window.
        itemStyle: { color: withAlpha(tokens.foreground, 0) },
        z: 2,
      },
    ],
  };
}
