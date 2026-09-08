import type { JSX } from "solid-js";

import type { BackgroundVariant } from "../../lib/chart-background";
import type { ChartConfig } from "../../lib/chart-tokens";
import type { LegendVariant } from "../../lib/echarts-legend";
import type { EChartsRenderer } from "../../lib/echarts-paint";
import type {
  TooltipPosition,
  TooltipRoundness,
  TooltipVariant,
} from "../../lib/echarts-tooltip";

/**
 * Radial chart — public types, slot shapes, and tuning constants.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-radial-chart.tsx` (MIT).
 *
 * Polar like the pie, but built on a completely different primitive: a BAR
 * series on a polar coordinate system, not a pie series. Each row is one
 * concentric ring whose arc length encodes its value. That means real angle and
 * radius axes — which the pie has none of — and a second polar just for the
 * background track.
 */

export type {
  BackgroundVariant,
  ChartConfig,
  EChartsRenderer,
  LegendVariant,
  TooltipPosition,
  TooltipRoundness,
  TooltipVariant,
};

/** The subset of ECharts' bar itemStyle this chart writes. */
export type BarItemStyle = { color: string | object; opacity: number };

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_INNER_RADIUS = "30%";
export const DEFAULT_OUTER_RADIUS = "100%";
export const DEFAULT_CORNER_RADIUS = 5;
export const DEFAULT_BAR_SIZE = 14;

/** Skeleton ring count — matches the Recharts twin. */
export const LOADING_BARS = 5;
/** Fixed angle-axis extent while loading; values roll in a 40–100 band. */
export const LOADING_MAX = 100;
export const LOADING_ANIMATION_DURATION = 2000;
/**
 * Intro sweep-in length. Runs ECharts' RAW default bar entrance (each ring
 * sweeps out from the start angle), on the FIRST real push only.
 */
export const REVEAL_DURATION = 1000;

/** Unfilled background ring, × muted-foreground alpha. */
export const TRACK_OPACITY = 0.15;
/** Unselected bars while a selection is active. */
export const SELECTED_DIM_OPACITY = 0.15;

/** Shimmer arc peak, × foreground alpha. */
export const LOADING_SHIMMER_MAX_OPACITY = 0.4;

/**
 * Stable series ids. `__`-prefixed ids are internal (background track, skeleton)
 * and stay silent; the main ring series is the only one that reports clicks and
 * feeds the tooltip.
 */
export const MAIN_SERIES_ID = "radial-bars";
export const TRACK_SERIES_ID = "__track";
/**
 * The track rides a SECOND, identical polar so it never shares a bar band with
 * the data rings — see buildTrackSeries.
 */
export const TRACK_POLAR_INDEX = 1;
export const LOADING_SERIES_ID = "__loading";
export const LOADING_TRACK_ID = "__loading-track";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type RadialVariant = "full" | "semi";

export interface EChartsRadialChartProps<TData extends Record<string, unknown>> {
  /** Rows rendered by the chart — one bar (ring) per row. */
  data: TData[];
  /** Bar colours + labels, keyed by each bar's NAME. */
  config: ChartConfig;
  /** Data key holding each bar's name. */
  nameKey: keyof TData & string;
  class?: string;
  renderer?: EChartsRenderer;
  /** Arc shape — full circle or half circle. */
  variant?: RadialVariant;
  /**
   * Value a full sweep represents. Without it the scale is derived from the
   * data, so the largest bar always fills the arc — set it (e.g. 100) for
   * gauges, where a single value has to read against a fixed total.
   */
  max?: number;
  innerRadius?: number | string;
  outerRadius?: number | string;
  defaultSelectedDataKey?: string | null;
  onSelectionChange?: (selection: { dataKey: string; value: number } | null) => void;
  isLoading?: boolean;
  /** Decorative pattern behind the chart. A prop here, not a marker. */
  backgroundVariant?: BackgroundVariant;
  chartOptions?: Record<string, unknown>;
  children?: JSX.Element;
}

// ─────────────────────────────────────────────────────────────────────────────
// Marker props
// ─────────────────────────────────────────────────────────────────────────────

export interface RadialBarProps {
  /** Value key — determines each bar's arc length. */
  dataKey: string;
  /** Rounding of each bar's ends, mapped to a rounded cap. */
  cornerRadius?: number;
  /** Thickness of each radial bar, in pixels. */
  barSize?: number;
  /** Renders the unfilled track behind each bar. */
  showBackground?: boolean;
  isClickable?: boolean;
}

export interface TooltipProps {
  variant?: TooltipVariant;
  roundness?: TooltipRoundness;
  defaultIndex?: number;
  position?: TooltipPosition;
}

export interface LegendProps {
  variant?: LegendVariant;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  isClickable?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Collected slot shapes
// ─────────────────────────────────────────────────────────────────────────────

export type RadialBarSlot = {
  dataKey: string;
  cornerRadius: number;
  barSize: number;
  showBackground: boolean;
  isClickable: boolean;
};

export type TooltipSlot = {
  present: boolean;
  variant: TooltipVariant;
  roundness: TooltipRoundness;
  defaultIndex?: number;
  position: TooltipPosition;
};

export type LegendSlot = {
  present: boolean;
  variant: LegendVariant;
  align: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  isClickable: boolean;
};

export type CollectedConfig = {
  radialBar: RadialBarSlot;
  tooltip: TooltipSlot;
  legend: LegendSlot;
};
