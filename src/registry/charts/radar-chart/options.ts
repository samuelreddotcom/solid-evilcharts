/**
 * Radar chart — pure option builders.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-radar-chart.tsx` (MIT).
 */
import { RadarChart, type RadarSeriesOption } from "echarts/charts";
import {
  RadarComponent,
  TooltipComponent,
  type TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";

import { shimmerWindowStops as sharedShimmerWindowStops } from "../../lib/chart-series";
import {
  FALLBACK_SERIES_COLOR,
  getColorsCount,
  withAlpha,
  type ChartConfig,
  type ResolvedColors,
} from "../../lib/chart-tokens";
import { dotStyle, sampleGradient } from "../../lib/echarts-dot";
import {
  resolveTooltipPosition,
  roundnessClass,
  tooltipIndicatorHtml,
  tooltipRow,
  tooltipVariantClass,
} from "../../lib/echarts-tooltip";
import {
  GRID_LINE_OPACITY,
  LOADING_MAX,
  STROKE_WIDTH,
  type LegendSlot,
  type PolarAngleAxisSlot,
  type PolarGridSlot,
  type PolarRadiusAxisSlot,
  type RadarSeriesConfig,
  type TooltipSlot,
} from "./types";

echarts.use([RadarChart, RadarComponent, TooltipComponent]);

export type EChartsOption = ComposeOption<RadarSeriesOption | TooltipComponentOption> & {
  radar?: RadarOption;
};

/**
 * ECharts' modular entrypoints don't export the radar component's option type,
 * and it is not part of the ComposeOption union, so the fields this chart writes
 * are declared here.
 */
export type RadarOption = {
  center: [string, string];
  radius: string;
  startAngle: number;
  shape: "polygon" | "circle";
  splitNumber: number;
  indicator: { name: string; max: number }[];
  axisName?: { show: boolean; color?: string; fontSize?: number };
  axisLine?: { show: boolean; lineStyle?: { color: string } };
  axisTick?: { show: boolean };
  splitLine?: { show: boolean; lineStyle?: { color: string; type?: [number, number] } };
  splitArea?: { show: boolean };
  axisLabel?: {
    show: boolean;
    color?: string;
    fontSize?: number;
    showMinLabel?: boolean;
  };
};

export type OptionBuildContext = {
  data: Record<string, unknown>[];
  config: ChartConfig;
  radars: RadarSeriesConfig[];
  seriesKeys: string[];
  selectedDataKey: string | null;
  hasSelection: boolean;
  gridSlot: PolarGridSlot;
  angleAxisSlot: PolarAngleAxisSlot;
  radiusAxisSlot: PolarRadiusAxisSlot;
  tooltipSlot: TooltipSlot;
  legendSlot: LegendSlot;
  isLoading: boolean;
  loadingData: () => number[];
  loadingPoints: number;
  resolved: ResolvedColors;
  /** Angle-axis labels — the indicator names. */
  categories: string[];
  /** Shared radius-axis max across every spoke. */
  indicatorMax: number;
};

export function shimmerWindowStops(center: number, color: string, peak: number) {
  return sharedShimmerWindowStops(center, color, peak, withAlpha);
}

/** Skeleton polygon as a smooth random walk in a comfortable band. */
export function getLoadingData(points: number): number[] {
  const rows: number[] = [];
  let value = 40 + Math.random() * 30;
  for (let i = 0; i < points; i++) {
    value = Math.min(LOADING_MAX, Math.max(20, value + (Math.random() - 0.5) * 30));
    rows.push(Math.round(value));
  }
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// Paints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Diagonal multi-stop stroke, mirroring the twin's StrokeGradient (0,0 → 1,1).
 *
 * bbox-relative, so each polygon vertex takes the colour at its position — the
 * canvas echo of an SVG stroke gradient clipping the polygon path.
 */
export function radarStrokePaint(
  slots: string[],
): string | echarts.graphic.LinearGradient {
  if (slots.length <= 1) return slots[0] ?? FALLBACK_SERIES_COLOR;
  const stops = slots.map((color, i) => ({ offset: i / (slots.length - 1), color }));
  return new echarts.graphic.LinearGradient(0, 0, 1, 1, stops);
}

/**
 * Radial centre→edge fill: the first colour at 0.8 alpha in the middle, fading
 * to 0.3 at the rim. bbox-relative, so the gradient's centre lands on the
 * radar's centre. The consumer's `fillOpacity` multiplies this via
 * `areaStyle.opacity`, exactly like the twin's prop.
 */
export function radarFillPaint(slots: string[]): echarts.graphic.RadialGradient {
  if (slots.length <= 1) {
    const base = slots[0] ?? FALLBACK_SERIES_COLOR;
    return new echarts.graphic.RadialGradient(0.5, 0.5, 0.5, [
      { offset: 0, color: withAlpha(base, 0.8) },
      { offset: 1, color: withAlpha(base, 0.3) },
    ]);
  }
  return new echarts.graphic.RadialGradient(
    0.5,
    0.5,
    0.5,
    slots.map((color, i) => ({
      offset: i / (slots.length - 1),
      color: withAlpha(color, i === 0 ? 0.8 : 0.3),
    })),
  );
}

/**
 * The twin only dims a CLICKABLE radar that isn't selected; a non-clickable one
 * keeps full opacity even when a sibling is selected.
 *
 * A dimmed radar's fill drops twice as far as its stroke and dots, so the
 * receding outline still reads.
 */
export function selectionOpacity(
  selected: string | null,
  key: string,
  isClickable: boolean,
): { fill: number; stroke: number; dot: number } {
  const isSelected = selected === null || selected === key;
  if (!isClickable || isSelected) return { fill: 1, stroke: 1, dot: 1 };
  return { fill: 0.1, stroke: 0.2, dot: 0.2 };
}

/** The largest value across every series — one shared radius scale. */
export function computeIndicatorMax(
  data: Record<string, unknown>[],
  seriesKeys: string[],
): number {
  let max = 0;
  for (const key of seriesKeys) {
    for (const row of data) max = Math.max(max, Number(row[key]) || 0);
  }
  return max || 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coordinate system
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The radar's vertical placement. A legend along the bottom (the default) floats
 * the coordinate system up to leave room.
 */
export function radarCenterY(legendSlot: LegendSlot): string {
  if (!legendSlot.present) return "50%";
  if (legendSlot.verticalAlign === "bottom") return "46%";
  if (legendSlot.verticalAlign === "top") return "54%";
  return "50%";
}

/**
 * Indicators, rings, spokes and the two label sets.
 *
 * Note the three presence gates map onto DIFFERENT parts: `<PolarGrid>` drives
 * both the spokes (`axisLine`) and the rings (`splitLine`), `<PolarAngleAxis>`
 * the perimeter labels (`axisName`), and `<PolarRadiusAxis>` the radial scale
 * (`axisLabel`). Their ECharts names do not line up with their component names.
 */
export function buildRadarComponent(ctx: OptionBuildContext): RadarOption {
  const { gridSlot, angleAxisSlot, radiusAxisSlot, isLoading, categories, indicatorMax } =
    ctx;
  const { tokens } = ctx.resolved;
  const gridColor = withAlpha(tokens.border, GRID_LINE_OPACITY);

  return {
    center: ["50%", radarCenterY(ctx.legendSlot)],
    radius: "68%",
    // Recharts starts the first category at the top and reads clockwise;
    // startAngle 90 places the first indicator at the top to match.
    startAngle: 90,
    shape: gridSlot.gridType,
    splitNumber: 4,
    indicator: categories.map((name) => ({ name, max: indicatorMax })),
    axisName: {
      show: angleAxisSlot.present && !isLoading,
      color: tokens.mutedForeground,
      fontSize: 10,
    },
    axisLine: {
      show: gridSlot.present && !isLoading,
      lineStyle: { color: gridColor },
    },
    axisTick: { show: false },
    splitLine: {
      show: gridSlot.present && !isLoading,
      lineStyle: { color: gridColor, type: [3, 4] as [number, number] },
    },
    splitArea: { show: false },
    axisLabel: {
      show: radiusAxisSlot.present && !isLoading,
      color: tokens.mutedForeground,
      fontSize: 10,
      showMinLabel: false, // the 0 at the dead centre reads as clutter
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Radar tooltips are item-triggered (one polygon at a time), so — unlike the
 * axis-triggered cartesian charts — the hovered SERIES is the header and its
 * per-category values are the rows. An accepted deviation from the Recharts
 * twin, which anchors on a category.
 */
export function createTooltipFormatter(ctx: OptionBuildContext) {
  const { config, selectedDataKey, tooltipSlot, categories } = ctx;

  return (params: unknown): string => {
    const param = (Array.isArray(params) ? params[0] : params) as {
      seriesId?: string;
      seriesName?: string;
      value?: number[];
    } | null;
    if (!param) return "";

    const key = param.seriesId ?? "";
    if (key.startsWith("__")) return "";

    const item = config[key];
    const colorsCount = item ? getColorsCount(item) : 1;
    const labelText =
      typeof item?.label === "string" ? item.label : (param.seriesName ?? key);
    const values = Array.isArray(param.value) ? param.value : [];
    const dimmed = selectedDataKey != null && selectedDataKey !== key ? " opacity-30" : "";

    // One row per category. `dimmed` is "" per row because a radar tooltip is a
    // single series — the dim goes on the whole shell below instead.
    const body = categories
      .map((category, i) => {
        const raw = values[i];
        const value = typeof raw === "number" ? raw.toLocaleString() : String(raw ?? "");
        return tooltipRow({
          indicatorHtml: tooltipIndicatorHtml(key, colorsCount),
          labelText: category,
          valueText: value,
          dimmed: "",
        });
      })
      .join("");

    // Custom shell, not the shared tooltipShell: this one dims the WHOLE surface
    // for a non-selected series and keeps a plain foreground header.
    return `<div class="grid min-w-32 items-start gap-1.5 border border-border/50 px-2.5 py-1.5 text-xs shadow-xl${dimmed} ${roundnessClass[tooltipSlot.roundness]} ${tooltipVariantClass[tooltipSlot.variant]}">
      <div class="font-medium">${labelText}</div>
      <div class="grid gap-1.5">${body}</div>
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
    displayTransition: false,
    position: resolveTooltipPosition(tooltipSlot.position),
    formatter: createTooltipFormatter(ctx),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Series
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One series per `<Radar>`. Each carries a SINGLE data item — one polygon over
 * every category — so all of its styling lives at the series level and every
 * vertex necessarily shares one dot colour.
 */
export function buildRadarSeries(ctx: OptionBuildContext): RadarSeriesOption[] {
  const { data, config, radars, selectedDataKey, hasSelection, categories, resolved } = ctx;

  return radars.map((radar) => {
    const key = radar.dataKey;
    const slots = resolved.series[key] ?? [FALLBACK_SERIES_COLOR];
    const strokePaint = radarStrokePaint(slots);
    // One data item means one itemStyle, so a multi-colour radar takes a single
    // representative dot colour rather than tinting each vertex.
    const dotColor = sampleGradient(slots, 0.5);
    // NOTE: this reads "not dimmed", not "is the selected one" — with no
    // selection at all it is true for every series. That makes the `: 2` branch
    // of the z expression below unreachable, which looks like a bug and is not:
    // it is upstream's behaviour, ported as-is rather than quietly corrected.
    const isSelected = selectedDataKey === null || selectedDataKey === key;
    const opacity = selectionOpacity(selectedDataKey, key, radar.isClickable);
    const isFilled = radar.variant === "filled";

    const restingVisible = radar.dotVariant !== "none";
    const activeVisible = radar.activeDotVariant !== "none";
    const restingDot = dotStyle(radar.dotVariant, dotColor, resolved.tokens.background);
    // The active marker falls back to "default" when only a resting dot is
    // declared, so hover always has something to promote to.
    const activeDot = dotStyle(
      radar.activeDotVariant === "none" ? "default" : radar.activeDotVariant,
      dotColor,
      resolved.tokens.background,
    );

    const value = categories.map((_, i) => Number(data[i]?.[key]) || 0);

    // ECharts radar has no per-state symbolSize and no numeric emphasis scale, so
    // the hover marker swaps STYLE at the resting size rather than growing.
    const symbol = restingVisible || activeVisible ? "circle" : "none";

    return {
      id: key,
      name: typeof config[key]?.label === "string" ? (config[key]?.label as string) : key,
      type: "radar",
      radarIndex: 0,
      data: [{ value }],
      symbol,
      symbolSize: restingVisible ? restingDot.size : activeDot.size,
      cursor: radar.isClickable ? "pointer" : "default",
      z: isSelected ? 3 : hasSelection ? 1 : 2,
      lineStyle: { color: strokePaint, width: STROKE_WIDTH, opacity: opacity.stroke },
      areaStyle: isFilled
        ? { color: radarFillPaint(slots), opacity: radar.fillOpacity * opacity.fill }
        : undefined,
      // Resting dots stay invisible when only an <ActiveDot> is declared.
      itemStyle: restingVisible
        ? { ...restingDot.itemStyle, opacity: opacity.dot }
        : { ...activeDot.itemStyle, opacity: 0 },
      // While a click selection is active it owns the canvas: native hover
      // emphasis would force a dimmed radar's dot back to full opacity, fighting
      // the selection dim — so hover highlighting stops until the selection
      // clears. The option rebuilds on selection change, so this is build-time.
      emphasis: hasSelection
        ? { disabled: true }
        : {
            // Promote the resting marker to the active variant; keep line and
            // fill exactly as they rest, so only the dot changes.
            itemStyle: { ...activeDot.itemStyle, opacity: 1 },
            lineStyle: {
              color: strokePaint,
              width: STROKE_WIDTH,
              opacity: opacity.stroke,
            },
            ...(isFilled
              ? {
                  areaStyle: {
                    color: radarFillPaint(slots),
                    opacity: radar.fillOpacity * opacity.fill,
                  },
                }
              : {}),
          },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ONE grey polygon regardless of declared radars, swept by the shimmer rAF. The
 * coordinate system exists but every visual axis element is hidden, so the
 * polygon floats on a clean canvas.
 */
export function buildLoadingOption(ctx: OptionBuildContext): EChartsOption {
  const { tokens } = ctx.resolved;
  const points = ctx.loadingPoints;

  return {
    animation: false,
    radar: {
      center: ["50%", radarCenterY(ctx.legendSlot)],
      radius: "68%",
      startAngle: 90,
      shape: ctx.gridSlot.gridType,
      splitNumber: 4,
      indicator: Array.from({ length: points }, (_, i) => ({
        name: `${i}`,
        max: LOADING_MAX,
      })),
      axisName: { show: false },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { show: false },
      splitArea: { show: false },
      axisLabel: { show: false },
    },
    tooltip: { show: false },
    series: [
      {
        id: "__loading",
        type: "radar",
        radarIndex: 0,
        silent: true,
        symbol: "none",
        data: [{ value: ctx.loadingData() }],
        // Invisible until the first shimmer tick positions the clip window.
        lineStyle: { color: withAlpha(tokens.foreground, 0), width: 2 },
        areaStyle: { color: withAlpha(tokens.foreground, 0) },
        z: 1,
      },
    ],
  };
}
