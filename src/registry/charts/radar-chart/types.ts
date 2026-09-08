import type { JSX } from "solid-js";

import type { ChartConfig } from "../../lib/chart-tokens";
import type { DotVariant } from "../../lib/echarts-dot";
import type { LegendVariant } from "../../lib/echarts-legend";
import type { EChartsRenderer } from "../../lib/echarts-paint";
import type {
  TooltipPosition,
  TooltipRoundness,
  TooltipVariant,
} from "../../lib/echarts-tooltip";

/**
 * Radar chart — public types, slot shapes, and tuning constants.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-radar-chart.tsx` (MIT).
 *
 * Polar, but on ECharts' dedicated `radar` coordinate system rather than a
 * `polar` one — so no angle/radius axis pair, just an indicator list. The
 * structural oddity is that **each series is a single data item**: one polygon
 * spanning every category, so all styling lives at the series level and there
 * is no per-datum anything.
 */

export type {
  ChartConfig,
  DotVariant,
  EChartsRenderer,
  LegendVariant,
  TooltipPosition,
  TooltipRoundness,
  TooltipVariant,
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const STROKE_WIDTH = 1;
/** Resting fill opacity for a filled radar — the twin's default. */
export const DEFAULT_FILL_OPACITY = 0.3;
export const LOADING_ANIMATION_DURATION = 2000;
export const REVEAL_DURATION = 1000;
/** Matches the Recharts twin's LOADING_POINTS. */
export const LOADING_DEFAULT_POINTS = 6;
/** Skeleton values live in [0, LOADING_MAX]. */
export const LOADING_MAX = 100;

/** Dashed rings + radial spokes, × border alpha. */
export const GRID_LINE_OPACITY = 1;
/** Skeleton outline inside the shimmer window, × foreground alpha. */
export const LOADING_STROKE_OPACITY = 0.5;
/** Skeleton FILL inside the shimmer window, × foreground alpha. */
export const LOADING_SHIMMER_MAX_OPACITY = 0.05;

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type RadarVariant = "filled" | "lines";
export type GridType = "polygon" | "circle";

export interface EChartsRadarChartProps<TData extends Record<string, unknown>> {
  /** Rows rendered by the chart — each row is one angle-axis category. */
  data: TData[];
  config: ChartConfig;
  class?: string;
  renderer?: EChartsRenderer;
  animation?: boolean;
  defaultSelectedDataKey?: string | null;
  onSelectionChange?: (key: string | null) => void;
  isLoading?: boolean;
  loadingPoints?: number;
  chartOptions?: Record<string, unknown>;
  children?: JSX.Element;
}

// ─────────────────────────────────────────────────────────────────────────────
// Marker props
// ─────────────────────────────────────────────────────────────────────────────

export interface RadarProps {
  dataKey: string;
  /** "filled" shows the fill, "lines" only the outline. */
  variant?: RadarVariant;
  fillOpacity?: number;
  isClickable?: boolean;
  children?: JSX.Element;
}

export interface DotProps {
  variant?: DotVariant;
}

export interface PolarGridProps {
  /** "polygon" (angular rings) or "circle" (circular rings). */
  gridType?: GridType;
}

export interface PolarAngleAxisProps {
  /** Data key whose values label the perimeter — overrides auto-detect. */
  dataKey?: string;
}

export interface TooltipProps {
  variant?: TooltipVariant;
  roundness?: TooltipRoundness;
  position?: TooltipPosition;
  /**
   * On canvas the radar tooltip is item-triggered (per polygon), so this selects
   * the DEFAULT SERIES to reveal, not a category.
   */
  defaultIndex?: number;
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

export type RadarSeriesConfig = {
  dataKey: string;
  variant: RadarVariant;
  fillOpacity: number;
  isClickable: boolean;
  /** "none" when no `<Dot>` child is present. */
  dotVariant: DotVariant;
  /** "none" when no `<ActiveDot>` child is present. */
  activeDotVariant: DotVariant;
};

export type PolarGridSlot = { present: boolean; gridType: GridType };
export type PolarAngleAxisSlot = { present: boolean; dataKey?: string };
export type PolarRadiusAxisSlot = { present: boolean };

export type TooltipSlot = {
  present: boolean;
  variant: TooltipVariant;
  roundness: TooltipRoundness;
  position: TooltipPosition;
  defaultIndex?: number;
};

export type LegendSlot = {
  present: boolean;
  variant: LegendVariant;
  align: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  isClickable: boolean;
};

export type CollectedConfig = {
  radars: RadarSeriesConfig[];
  grid: PolarGridSlot;
  angleAxis: PolarAngleAxisSlot;
  radiusAxis: PolarRadiusAxisSlot;
  tooltip: TooltipSlot;
  legend: LegendSlot;
};
