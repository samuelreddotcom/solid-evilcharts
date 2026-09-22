import type { BarSeriesOption, LineSeriesOption } from "echarts/charts";
import type * as echarts from "echarts/core";
import type { ImagePatternObject } from "echarts/core";
import type { JSX } from "solid-js";

import type { CurveType } from "../../lib/chart-series";
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
 * Composed chart — bars and lines on one shared category axis.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-composed-chart.tsx` (MIT).
 *
 * This is a deliberate SIMPLIFICATION of the two charts it merges, not a union
 * of them. Its `BarVariant` drops `blocks` and `expandable` (both need
 * post-layout measurement, which would drag the whole measure/re-push cycle in
 * for one variant), and its `<Line>` drops buffer lines and hover-reveal. What
 * it adds is the mixed-series machinery: two glow strategies, a two-shape
 * loading skeleton, and a brush that mirrors both kinds as area-lines.
 */

export type {
  ChartConfig,
  CurveType,
  DotVariant,
  EChartsRenderer,
  LegendVariant,
  TooltipPosition,
  TooltipRoundness,
  TooltipVariant,
};

/** Anything ECharts will accept as a series fill. */
export type SeriesPaint = string | echarts.graphic.LinearGradient | ImagePatternObject;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Line stroke width — the Recharts twin draws lines at 2px, not the 0.8 the pure line chart uses. */
export const STROKE_WIDTH = 2;
/** Tooltip cursor line. */
export const AXIS_POINTER_WIDTH = 1;
/** Bar corner radius, matching the Recharts twin. */
export const DEFAULT_BAR_RADIUS = 4;
export const LOADING_ANIMATION_DURATION = 2000;
export const REVEAL_DURATION = 1000;
/**
 * Per-bar grow-in length. Unlike the line's clip (which ECharts hardcodes to
 * linear left-to-right), bars are independent rectangles, so the direction
 * values are honoured via a per-datum `animationDelay`.
 */
export const BAR_GROW_DURATION = 500;
export const BAR_STAGGER = 50;
export const LOADING_DEFAULT_BARS = 12;
/** Dashed stroke — the twin uses "5 5". */
export const DASH_PATTERN: [number, number] = [5, 5];
/** Sum of DASH_PATTERN — the animated sweep travels one period per second. */
export const DASH_PERIOD = 10;

/** Dashed value-axis split lines, × border alpha. */
export const GRID_LINE_OPACITY = 1;
/** Skeleton bar fill inside the shimmer window, × foreground alpha. */
export const LOADING_BAR_MAX_OPACITY = 0.22;
/** Skeleton line stroke inside the shimmer window, × foreground alpha. */
export const LOADING_LINE_MAX_OPACITY = 0.5;
export const LOADING_LINE_WIDTH = 2;
export const BRUSH_STROKE_OPACITY = 0.5;
export const BRUSH_FILL_OPACITY = 0.15;
export const BRUSH_FILLER_OPACITY = 0;

/** Bar glow radius, canvas shadowBlur. */
export const BAR_GLOW_BLUR = 16;
/** Bar glow strength, × series colour alpha. */
export const BAR_GLOW_OPACITY = 0.6;

/**
 * Line glow: SILENT copies of the stroke stacked UNDER the real line, all at the
 * SAME NARROW WIDTH so they stay hidden beneath it — the visible halo is
 * entirely each copy's canvas `shadowBlur`. Widening the copies instead paints
 * concentric contour rings, because a translucent stroke has a hard edge and
 * every extra layer adds another visible boundary.
 *
 * Bars use a plain shadow instead, because a bar is a solid shape whose single
 * shadowColor can sit under it without banding — a line's horizontal gradient
 * cannot be followed by one flat shadow.
 */
export const LINE_GLOW_LAYERS: { width: number; opacity: number; blur: number }[] = [
  { width: 2, opacity: 0.9, blur: 5 },
  { width: 2, opacity: 0.6, blur: 12 },
  { width: 2, opacity: 0.38, blur: 24 },
  { width: 2, opacity: 0.22, blur: 42 },
];

/** Dim applied to an unselected series' strokes and dots. */
export const SELECTION_DIM = 0.3;
/** Dim applied to an unselected series' FILLS — deeper, since a fill is denser. */
export const SELECTION_DIM_FILL = 0.15;

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

/** No `blocks` or `expandable` here — both need post-layout measurement. */
export type BarVariant =
  | "default"
  | "hatched"
  | "duotone"
  | "duotone-reverse"
  | "gradient"
  | "stripped";

/**
 * A smaller list than the bar chart's — this chart has no `blocks`. Painted as
 * a canvas pattern, so it renders flat under `renderer="svg"`.
 */
export const CANVAS_ONLY_BAR_VARIANTS = ["hatched"] as const;

export type StrokeVariant = "solid" | "dashed" | "animated-dashed";

export type ComposedAnimationType =
  | "none"
  | "left-to-right"
  | "right-to-left"
  | "center-out"
  | "edges-in";

export interface EChartsComposedChartProps<TData extends Record<string, unknown>> {
  data: TData[];
  /** Series colours + labels for every bar AND line. */
  config: ChartConfig;
  renderer?: EChartsRenderer;
  xDataKey?: keyof TData & string;
  class?: string;
  curveType?: CurveType;
  animation?: boolean;
  animationType?: ComposedAnimationType;
  /** ECharts accepts "30%" or a pixel number. */
  barGap?: number | string;
  barCategoryGap?: number | string;
  defaultSelectedDataKey?: string | null;
  onSelectionChange?: (key: string | null) => void;
  isLoading?: boolean;
  loadingBars?: number;
  chartOptions?: Record<string, unknown>;
  children?: JSX.Element;
}

// ─────────────────────────────────────────────────────────────────────────────
// Marker props
// ─────────────────────────────────────────────────────────────────────────────

export interface BarProps {
  dataKey: string;
  variant?: BarVariant;
  radius?: number;
  /** Applies a soft neon glow — a canvas shadow, for bars. */
  glow?: boolean;
  animationType?: ComposedAnimationType;
  isClickable?: boolean;
  /** Dims the other columns of THIS bar when one is hovered. */
  enableHoverHighlight?: boolean;
  /** Escape hatch merged into the raw ECharts bar series. */
  barProps?: Partial<BarSeriesOption>;
}

export interface LineProps {
  dataKey: string;
  strokeVariant?: StrokeVariant;
  curveType?: CurveType;
  animationType?: ComposedAnimationType;
  connectNulls?: boolean;
  /** Applies a soft neon glow — stacked overlay copies, for lines. */
  glow?: boolean;
  isClickable?: boolean;
  children?: JSX.Element;
  /** Escape hatch merged into the raw ECharts line series. */
  lineProps?: Partial<LineSeriesOption>;
}

export interface DotProps {
  variant?: DotVariant;
}

export interface XAxisProps {
  dataKey?: string;
  tickFormatter?: (value: string, index: number) => string;
  label?: string;
  hideDots?: boolean;
}

export interface YAxisProps {
  dataKey?: string;
  tickFormatter?: (value: number, index: number) => string;
  label?: string;
  hideDots?: boolean;
}

export interface TooltipProps {
  variant?: TooltipVariant;
  roundness?: TooltipRoundness;
  cursor?: boolean;
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

export type BarSeriesConfig = {
  dataKey: string;
  variant: BarVariant;
  radius: number;
  glow: boolean;
  animationType?: ComposedAnimationType;
  isClickable: boolean;
  enableHoverHighlight: boolean;
  barProps?: Partial<BarSeriesOption>;
};

export type LineSeriesConfig = {
  dataKey: string;
  strokeVariant: StrokeVariant;
  curveType?: CurveType;
  animationType?: ComposedAnimationType;
  connectNulls: boolean;
  glow: boolean;
  isClickable: boolean;
  dotVariant: DotVariant;
  activeDotVariant: DotVariant;
  lineProps?: Partial<LineSeriesOption>;
};

export type XAxisSlot = {
  present: boolean;
  dataKey?: string;
  tickFormatter?: (value: string, index: number) => string;
  label?: string;
  hideDots: boolean;
};

export type YAxisSlot = {
  present: boolean;
  dataKey?: string;
  tickFormatter?: (value: number, index: number) => string;
  label?: string;
  hideDots: boolean;
};

export type TooltipSlot = {
  present: boolean;
  variant: TooltipVariant;
  roundness: TooltipRoundness;
  cursor: boolean;
  position: TooltipPosition;
};

export type LegendSlot = {
  present: boolean;
  variant: LegendVariant;
  align: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  isClickable: boolean;
};

export type BrushSlot = {
  present: boolean;
  height?: number;
  formatLabel?: (value: string, index: number) => string;
  onChange?: (range: { startIndex: number; endIndex: number }) => void;
};

export type CollectedConfig = {
  bars: BarSeriesConfig[];
  lines: LineSeriesConfig[];
  xAxis: XAxisSlot;
  yAxis: YAxisSlot;
  showGrid: boolean;
  tooltip: TooltipSlot;
  legend: LegendSlot;
  brush: BrushSlot;
};
