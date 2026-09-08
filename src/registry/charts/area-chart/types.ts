/**
 * Area chart — public types, slot shapes, and tuning constants.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-area-chart.tsx` (MIT).
 *
 * Differences from the line chart, which this otherwise mirrors:
 * • gains a fill system (`AreaVariant`, see ./fills.ts) and stacking (`StackType`)
 * • gains a controlled `selectedDataKey` prop
 * • drops the glow overlay entirely
 */
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

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Default series stroke — `<Area strokeWidth>` overrides it. */
export const STROKE_WIDTH = 0.8;
/** Shimmer loop length, in milliseconds. */
export const LOADING_ANIMATION_DURATION = 2000;
/**
 * Intro draw-in length, in milliseconds. Runs ECharts' RAW default entrance;
 * custom easing was tried and abandoned upstream, since ECharts hardcodes the
 * line-entrance clip to linear and ignores animationEasing at every level.
 */
export const REVEAL_DURATION = 1000;
export const LOADING_DEFAULT_POINTS = 14;
/** Buffer tail: 4px dash / 3px gap, echoing the Recharts forecast tail. */
export const BUFFER_DASH: [number, number] = [4, 3];

// ─────────────────────────────────────────────────────────────────────────────
// Theme knobs. Base colours come from the consumer's CSS tokens, so only the
// opacity factors live here. Factors MULTIPLY the token's own alpha.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dashed y-axis split lines, × border alpha. Recharts draws its grid at
 * border/50, but SVG dashes render pixel-crisp while canvas at 2× DPR spreads a
 * 1px line across device pixels — roughly halving perceived intensity. The full
 * token alpha lands both engines at the same apparent brightness.
 */
export const GRID_LINE_OPACITY = 1;
/** Tooltip cursor line, × border alpha. */
export const AXIS_POINTER_OPACITY = 1;
/** Skeleton outline inside the shimmer window, × foreground alpha. */
export const LOADING_STROKE_OPACITY = 0.5;
/** Skeleton FILL inside the shimmer window, × foreground alpha. */
export const LOADING_SHIMMER_MAX_OPACITY = 0.03;
/** Mini-chart series stroke. */
export const BRUSH_STROKE_OPACITY = 0.5;
/** Mini-chart series fade, at the top stop. */
export const BRUSH_FILL_OPACITY = 0.15;
/** Selected-range wash — evil-brush draws none. */
export const BRUSH_FILLER_OPACITY = 0;

/**
 * Marks the dashed forecast overlay of a buffer area. Carries the SAME key's
 * value, so the tooltip recovers the key from it.
 */
export const BUFFER_PREFIX = "__buffer-";
/**
 * Marks the fill-only patch under a buffer tail. Purely internal — the main
 * area drops its last point so the tail can be dashed, which also removes the
 * fill beneath that segment; this layer puts it back.
 */
export const BUFFERFILL_PREFIX = "__bufferfill-";
/** Marks the muted base layer of a hover-reveal area. Internal. */
export const REVEAL_PREFIX = "__reveal-";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

/** The fill styles. `none` is stroke-only — no fill at all. */
export type AreaVariant =
  | "gradient"
  | "gradient-reverse"
  | "solid"
  | "dotted"
  | "lines"
  | "hatched"
  | "none";

export type StrokeVariant = "solid" | "dashed" | "animated-dashed";

/** How multiple areas combine. `expanded` normalises each row to 100%. */
export type StackType = "default" | "stacked" | "expanded";

export type AreaAnimationType =
  | "none"
  | "left-to-right"
  | "right-to-left"
  | "center-out"
  | "edges-in";

export interface EChartsAreaChartProps<TData extends Record<string, unknown>> {
  /** Rows rendered by the chart. */
  data: TData[];
  /** Series colours + labels. */
  config: ChartConfig;
  /** Rendering engine — defaults to canvas. */
  renderer?: EChartsRenderer;
  /** x category key — falls back to the `<XAxis>` dataKey, then the first free column. */
  xDataKey?: keyof TData & string;
  /** Extra classes for the chart container. */
  class?: string;
  /** Default curve interpolation each `<Area>` inherits. */
  curveType?: CurveType;
  /** How multiple areas combine. */
  stackType?: StackType;
  /** Master switch for the intro draw-in — false renders instantly. */
  animation?: boolean;
  /** Default intro reveal (the first `<Area>` overrides). */
  animationType?: AreaAnimationType;
  /** Hovering a series dims the others, like a temporary selection. */
  enableHoverHighlight?: boolean;
  /** Hovering colours each area up to the pointer's x and mutes the rest. */
  enableHoverReveal?: boolean;
  /** Series selected on first render, when uncontrolled. */
  defaultSelectedDataKey?: string | null;
  /** Controlled selection — overrides internal state when provided. */
  selectedDataKey?: string | null;
  /** Fires when the selected series changes. */
  onSelectionChange?: (key: string | null) => void;
  /** Shows the animated loading skeleton. */
  isLoading?: boolean;
  /** Number of points in the loading skeleton. */
  loadingPoints?: number;
  /** Escape hatch merged over the built ECharts option. */
  chartOptions?: Record<string, unknown>;
  /** Declarative config — `<Area>`, `<XAxis>`, `<Grid>`, `<Tooltip>`, … */
  children?: JSX.Element;
}

// ─────────────────────────────────────────────────────────────────────────────
// Marker props
// ─────────────────────────────────────────────────────────────────────────────

export interface AreaProps {
  /** Series key — must exist on the data and config. */
  dataKey: string;
  /** Fill style for this area only. */
  variant?: AreaVariant;
  strokeVariant?: StrokeVariant;
  strokeWidth?: number;
  /** Curve interpolation — falls back to the root curveType. */
  curveType?: CurveType;
  /** Intro reveal — the first area drives the wrapper wipe. */
  animationType?: AreaAnimationType;
  connectNulls?: boolean;
  isClickable?: boolean;
  /** Renders this area's last segment as a dashed, fill-less buffer. */
  enableBufferLine?: boolean;
  /** Optional `<Dot>` and `<ActiveDot>` config. */
  children?: JSX.Element;
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

export type AreaSeriesConfig = {
  dataKey: string;
  variant: AreaVariant;
  strokeVariant: StrokeVariant;
  strokeWidth: number;
  curveType?: CurveType;
  animationType?: AreaAnimationType;
  connectNulls: boolean;
  isClickable: boolean;
  enableBufferLine: boolean;
  dotVariant: DotVariant;
  activeDotVariant: DotVariant;
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
  areas: AreaSeriesConfig[];
  xAxis: XAxisSlot;
  yAxis: YAxisSlot;
  showGrid: boolean;
  tooltip: TooltipSlot;
  legend: LegendSlot;
  brush: BrushSlot;
};
