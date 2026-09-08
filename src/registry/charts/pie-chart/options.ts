/**
 * Pie chart — pure option builders.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-pie-chart.tsx` (MIT).
 */
import { PieChart, type PieSeriesOption } from "echarts/charts";
import { TooltipComponent, type TooltipComponentOption } from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";

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
  DIMMED_OPACITY,
  LOADING_BASE_OPACITY,
  LOADING_PEAK_OPACITY,
  LOADING_SECTORS,
  LOADING_SHIMMER_BAND,
  LOADING_SHIMMER_FEATHER,
  OVERLAP_BORDER_WIDTH,
  SELECTED_OFFSET,
  type LegendSlot,
  type PieItemStyle,
  type PieSlot,
  type TooltipSlot,
} from "./types";

echarts.use([PieChart, TooltipComponent]);

export type EChartsOption = ComposeOption<PieSeriesOption | TooltipComponentOption>;

export type OptionBuildContext = {
  data: Record<string, unknown>[];
  config: ChartConfig;
  nameKey: string;
  dataKey: string;
  pie: PieSlot | null;
  selectedSector: string | null;
  tooltipSlot: TooltipSlot;
  legendSlot: LegendSlot;
  isLoading: boolean;
  resolved: ResolvedColors;
};

// ─────────────────────────────────────────────────────────────────────────────
// Sector geometry helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Positive gaps between sectors are drawn as a CONSTANT-WIDTH background-coloured
 * border (px), NOT an angular padAngle.
 *
 * An angular pad tapers to a wedge toward the centre; a border keeps every gap
 * parallel-edged all the way from the rim in. The px width tracks the requested
 * `paddingAngle` so the prop still feels familiar.
 */
export function gapBorderWidth(paddingAngle: number): number {
  return Math.max(paddingAngle, 0);
}

/**
 * Resolves each sector's separator border. Negative paddingAngle keeps the
 * overlapping-petal look (a real angular overlap plus a wide separator);
 * positive becomes a constant-width gap; zero draws no border at all.
 */
export function sectorBorder(
  paddingAngle: number,
  background: string,
): { borderColor: string; borderWidth: number } | null {
  if (paddingAngle < 0) {
    return { borderColor: background, borderWidth: OVERLAP_BORDER_WIDTH };
  }
  const width = gapBorderWidth(paddingAngle);
  if (width > 0) return { borderColor: background, borderWidth: width };
  return null;
}

/**
 * A sector's fill. Multi-colour series run their gradient DIAGONALLY (0,0 → 1,1)
 * so the run reads across a wedge, which has no meaningful horizontal axis.
 */
export function sectorPaint(slots: string[]): string | echarts.graphic.LinearGradient {
  if (slots.length <= 1) return slots[0] ?? FALLBACK_SERIES_COLOR;
  const stops = slots.map((color, i) => ({ offset: i / (slots.length - 1), color }));
  return new echarts.graphic.LinearGradient(0, 0, 1, 1, stops);
}

/**
 * The pie's vertical centre reserves room for the HTML legend overlay: a legend
 * along the bottom nudges the pie up, one along the top nudges it down.
 */
export function pieCenterY(legendSlot: LegendSlot): string {
  if (!legendSlot.present) return "50%";
  if (legendSlot.verticalAlign === "bottom") return "45%";
  if (legendSlot.verticalAlign === "top") return "55%";
  return "50%";
}

/**
 * Per-sector shimmer alpha: a sine-feathered window centred on `center` (both
 * values are ring fractions in [0, 1)).
 *
 * Distance wraps AROUND the ring, so the highlight travels continuously past
 * 12 o'clock instead of jumping back to the start — the angular twin of the
 * cartesian charts' swept clip window.
 */
export function loadingSectorAlpha(pos: number, center: number): number {
  const raw = Math.abs(pos - center);
  const dist = Math.min(raw, 1 - raw); // shortest way around the ring
  const half = LOADING_SHIMMER_BAND;
  const feather = LOADING_SHIMMER_FEATHER;

  if (dist >= half) return LOADING_BASE_OPACITY;
  if (dist <= half - feather) return LOADING_PEAK_OPACITY;
  // Sine-eased ramp — a linear one still reads as a hard cut.
  const t = 1 - (dist - (half - feather)) / feather;
  const eased = Math.sin((t * Math.PI) / 2);
  return LOADING_BASE_OPACITY + (LOADING_PEAK_OPACITY - LOADING_BASE_OPACITY) * eased;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The pie tooltip is ITEM-triggered, so each hover surfaces exactly one sector.
 * It keeps its own no-header shell rather than the shared `tooltipShell`, which
 * always renders a header row.
 */
export function createTooltipFormatter(ctx: OptionBuildContext) {
  const { config, selectedSector, tooltipSlot } = ctx;

  return (params: unknown): string => {
    const p = (Array.isArray(params) ? params[0] : params) as {
      name?: string;
      value?: number | string;
      seriesId?: string;
    } | null;
    // The loading skeleton is a `__`-prefixed series and never surfaces.
    if (!p || String(p.seriesId ?? "").startsWith("__")) return "";

    const name = String(p.name ?? "");
    const item = config[name];
    const colorsCount = item ? getColorsCount(item) : 1;
    const labelText = typeof item?.label === "string" ? item.label : name;
    const value =
      typeof p.value === "number" ? p.value.toLocaleString() : String(p.value ?? "");
    const dimmed = selectedSector != null && selectedSector !== name ? " opacity-30" : "";

    const row = tooltipRow({
      indicatorHtml: tooltipIndicatorHtml(name, colorsCount),
      labelText,
      valueText: value,
      dimmed,
    });

    return `<div class="grid min-w-32 items-start gap-1.5 border border-border/50 px-2.5 py-1.5 text-xs shadow-xl ${roundnessClass[tooltipSlot.roundness]} ${tooltipVariantClass[tooltipSlot.variant]}">
      <div class="grid gap-1.5">${row}</div>
    </div>`;
  };
}

/**
 * Item-triggered, so it can't use the shared `tooltipBaseOption` — that one is
 * `trigger: "axis"` with an axisPointer, and a pie has no axis.
 */
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
// Pie series
// ─────────────────────────────────────────────────────────────────────────────

export function buildPieSeries(ctx: OptionBuildContext): PieSeriesOption[] {
  const { data, config, nameKey, dataKey, pie, selectedSector, legendSlot, resolved } = ctx;
  if (!pie) return [];
  const { tokens } = resolved;
  const hasSelection = selectedSector !== null;
  const border = sectorBorder(pie.paddingAngle, tokens.background);

  const sectors = data.map((row) => {
    const name = String(row[nameKey]);
    const slots = resolved.series[name] ?? [FALLBACK_SERIES_COLOR];
    // Only a clickable pie dims — a static one never has a selection to dim from.
    const isSelected = pie.isClickable && selectedSector === name;
    const isDimmed = pie.isClickable && hasSelection && selectedSector !== name;

    const itemStyle: PieItemStyle = {
      color: sectorPaint(slots),
      opacity: isDimmed ? DIMMED_OPACITY : 1,
      borderRadius: pie.cornerRadius,
    };
    if (border) {
      itemStyle.borderColor = border.borderColor;
      itemStyle.borderWidth = border.borderWidth;
    }

    // The `selected` flag drives the native offset — our selection state is the
    // single source of truth, re-applied on every notMerge push so it survives.
    return { name, value: Number(row[dataKey]) || 0, itemStyle, selected: isSelected };
  });

  const showLabel = pie.labelDataKey !== null;
  const isOutside = pie.labelPosition === "outside";
  // An explicit <Label dataKey> always wins. Otherwise INSIDE labels show the
  // sector's value (Recharts parity) and OUTSIDE labels show its name.
  const explicitKey = pie.labelDataKey ? pie.labelDataKey : null;
  const labelFormatter = (labelParams: {
    dataIndex: number;
    name?: string;
    value?: unknown;
  }) => {
    if (explicitKey) return String(data[labelParams.dataIndex]?.[explicitKey] ?? "");
    if (isOutside) {
      const item = config[String(labelParams.name ?? "")];
      return typeof item?.label === "string" ? item.label : String(labelParams.name ?? "");
    }
    return String(data[labelParams.dataIndex]?.[dataKey] ?? labelParams.value ?? "");
  };

  return [
    {
      id: "pie",
      type: "pie",
      center: ["50%", pieCenterY(legendSlot)],
      radius: [pie.innerRadius, pie.outerRadius],
      startAngle: pie.startAngle,
      endAngle: pie.endAngle,
      // Recharts sweeps counterclockwise from 3 o'clock; ECharts shares that
      // angle orientation, so `clockwise: false` reproduces the sector order.
      clockwise: false,
      // Only a NEGATIVE paddingAngle reaches padAngle (petal overlap). Positive
      // gaps become constant-width borders — see sectorBorder.
      padAngle: Math.min(pie.paddingAngle, 0),
      cursor: pie.isClickable ? "pointer" : "default",
      // No hover scale on any variant — hovering only surfaces the tooltip. The
      // pop-out is the sole selection affordance, never a hover effect.
      emphasis: { scale: false },
      selectedMode: pie.isClickable ? "single" : false,
      selectedOffset: SELECTED_OFFSET,
      // Neutralise ECharts' default select styling — the selected sector keeps
      // its normal paint and only its POSITION moves.
      select: { itemStyle: {} },
      label: {
        show: showLabel,
        // Inner value labels sit on the coloured sector in background-coloured
        // text; outer name labels sit past the rim in muted-foreground.
        position: (isOutside ? "outside" : "inner") as "outside" | "inner",
        color: isOutside ? tokens.mutedForeground : tokens.background,
        fontSize: 12,
        fontWeight: 500,
        formatter: labelFormatter,
      },
      labelLine: isOutside
        ? {
            show: true,
            length: 14,
            length2: 14,
            smooth: false,
            lineStyle: { color: withAlpha(tokens.mutedForeground, 0.45), width: 1 },
          }
        : { show: false },
      data: sectors,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ONE grey ring of equal sectors regardless of the real data (Recharts parity),
 * swept by the shimmer rAF. Respects the pie's shape, so a donut skeleton stays
 * a donut. The per-sector colour here is a placeholder — the rAF retints every
 * sector each frame.
 */
export function buildLoadingOption(ctx: OptionBuildContext): EChartsOption {
  const { pie, legendSlot, resolved } = ctx;
  const { tokens } = resolved;

  const innerRadius = pie?.innerRadius ?? 0;
  const outerRadius = pie?.outerRadius ?? "80%";
  const cornerRadius = pie?.cornerRadius ?? 0;
  const paddingAngle = pie?.paddingAngle ?? 0;
  const startAngle = pie?.startAngle ?? 0;
  const endAngle = pie?.endAngle ?? 360;

  const border = sectorBorder(paddingAngle, tokens.background);
  const sectors = Array.from({ length: LOADING_SECTORS }, (_, i) => {
    const itemStyle: PieItemStyle = {
      color: withAlpha(tokens.foreground, LOADING_BASE_OPACITY),
      opacity: 1,
      borderRadius: cornerRadius,
    };
    if (border) {
      itemStyle.borderColor = border.borderColor;
      itemStyle.borderWidth = border.borderWidth;
    }
    return { name: `__loading-${i}`, value: 1, itemStyle };
  });

  return {
    animation: false,
    tooltip: { show: false },
    series: [
      {
        id: "__loading",
        type: "pie",
        center: ["50%", pieCenterY(legendSlot)],
        radius: [innerRadius, outerRadius],
        startAngle,
        endAngle,
        clockwise: false,
        padAngle: Math.min(paddingAngle, 0),
        silent: true,
        emphasis: { scale: false },
        label: { show: false },
        labelLine: { show: false },
        data: sectors,
      },
    ],
  };
}

/**
 * One shimmer frame's worth of skeleton sectors.
 *
 * Rebuilds the FULL itemStyle for each sector: setOption replaces a series' data
 * array wholesale, so a partial datum would silently drop the border and
 * rounding the resting skeleton established.
 */
export function buildShimmerSectors(params: {
  phase: number;
  foreground: string;
  background: string;
  cornerRadius: number;
  paddingAngle: number;
}): { value: number; itemStyle: PieItemStyle }[] {
  const { phase, foreground, background, cornerRadius, paddingAngle } = params;
  const border = sectorBorder(paddingAngle, background);

  return Array.from({ length: LOADING_SECTORS }, (_, i) => {
    const pos = (i + 0.5) / LOADING_SECTORS;
    const itemStyle: PieItemStyle = {
      color: withAlpha(foreground, loadingSectorAlpha(pos, phase)),
      opacity: 1,
      borderRadius: cornerRadius,
    };
    if (border) {
      itemStyle.borderColor = border.borderColor;
      itemStyle.borderWidth = border.borderWidth;
    }
    return { value: 1, itemStyle };
  });
}
