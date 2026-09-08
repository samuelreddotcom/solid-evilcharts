import type { JSX } from "solid-js";

import type { ChartConfig } from "../../lib/chart-tokens";
import type { LegendVariant } from "../../lib/echarts-legend";
import type { EChartsRenderer } from "../../lib/echarts-paint";
import type {
  TooltipPosition,
  TooltipRoundness,
  TooltipVariant,
} from "../../lib/echarts-tooltip";

/**
 * Bar chart — public types, slot shapes, and tuning constants.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-bar-chart.tsx` (MIT).
 *
 * A bigger departure from line/area than those two were from each other:
 * • eight fill variants, several needing per-datum paints (see ./paints.ts)
 * • a `layout` swap that exchanges the category and value axes
 * • measurements taken off the live coordinate system after first layout
 */

export type {
  ChartConfig,
  EChartsRenderer,
  LegendVariant,
  TooltipPosition,
  TooltipRoundness,
  TooltipVariant,
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_BAR_RADIUS = 2;
/** Buffer-bar outline width. */
export const STROKE_WIDTH = 1;
export const LOADING_ANIMATION_DURATION = 2000;
/** Per-bar grow-in length, in milliseconds. */
export const BAR_GROW_DURATION = 500;
/** Delay between consecutive bars in the reveal, in milliseconds. */
export const BAR_STAGGER = 50;
export const LOADING_DEFAULT_BARS = 12;

/** Opacity of an unselected series while a selection is active. */
export const SELECTION_DIM = 0.3;
/** Opacity of the non-hovered bars while hover-highlight is on. */
export const HOVER_BLUR = 0.3;

/**
 * Soft outer glow — the canvas analogue of the Recharts feGaussianBlur filter.
 * A generous shadowBlur keeps the halo soft with no hard rim; the shadowColor is
 * sampled PER BAR so a multi-stop gradient series glows in its own colours
 * across the plot instead of one flat tint.
 */
export const GLOW_BLUR = 18;
/** Per-datum shadowColor alpha, × the sampled series colour. */
export const GLOW_OPACITY = 0.65;

/**
 * The `expandable` variant draws every bar at full width but fills only a narrow
 * centre strip, so it reads as a thin line; hovering one grows its strip to the
 * full width and back on leave. The bar geometry never changes — only the
 * horizontal extent of its fill — so nothing re-lays out mid-hover.
 */
export const EXPAND_COLLAPSED = 0.12;
/** Ease time-constant, in milliseconds (exponential approach). */
export const EXPAND_TAU = 70;

/** Filled segment height for the `blocks` variant, in pixels. */
export const BLOCK_SIZE = 8;
/** Transparent gap between block segments, in pixels. */
export const BLOCK_GAP = 4;
/** Unfilled block tone, × the muted-foreground alpha. */
export const BLOCK_TRACK_OPACITY = 0.22;

/**
 * Separation between stacked segments, in pixels.
 *
 * A REAL gap — transparent spacer series stacked between the real ones — not a
 * background-coloured border. A border paints on all four sides, so it outlines
 * each segment (obvious the moment a bar glows) instead of only parting them.
 */
export const STACK_SEGMENT_GAP = 4;
/** Non-winning columns under enableMaxValueHighlight, × muted-foreground. */
export const MAX_HIGHLIGHT_DIM = 0.16;

/**
 * The `stripped` variant caps each bar with a small BRIGHT pill of CONSTANT
 * pixel height. The cap is expressed PER DATUM as a fraction of that bar's own
 * pixel height, derived at runtime from the measured value-axis
 * pixels-per-unit. A canvas gradient alone can't do this: its bright band is a
 * fraction of the bounding box, so it would scale with bar length.
 */
export const STRIPPED_CAP_HEIGHT = 4;
/** Dimmed bar body below the cap, × series colour. */
export const STRIPPED_BODY_ALPHA = 0.2;
/** The cap never swallows a whole (very short) bar. */
export const STRIPPED_CAP_MAX_FRACTION = 0.85;
/** Used before the axis geometry has been measured. */
export const STRIPPED_FALLBACK_FRACTION = 0.12;

/** Dashed value-axis split lines, × border alpha. */
export const GRID_LINE_OPACITY = 1;
/** Grey bar fill inside the shimmer window, × foreground alpha. */
export const LOADING_SHIMMER_MAX_OPACITY = 0.22;
/** Mini-chart bar fill. */
export const BRUSH_FILL_OPACITY = 0.5;
/** Selected-range wash — evil-brush draws none. */
export const BRUSH_FILLER_OPACITY = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type BarVariant =
  | "default"
  | "hatched"
  | "duotone"
  | "duotone-reverse"
  | "gradient"
  | "stripped"
  | "blocks"
  | "expandable";

export type StackType = "default" | "stacked" | "percent";

export type BarLayout = "vertical" | "horizontal";

export type BarAnimationType =
  | "none"
  | "left-to-right"
  | "right-to-left"
  | "center-out"
  | "edges-in";

export interface EChartsBarChartProps<TData extends Record<string, unknown>> {
  data: TData[];
  config: ChartConfig;
  renderer?: EChartsRenderer;
  /** Category key — falls back to the axis dataKey, then the first free column. */
  xDataKey?: keyof TData & string;
  class?: string;
  stackType?: StackType;
  layout?: BarLayout;
  /** Default corner radius every `<Bar>` inherits. */
  barRadius?: number;
  animation?: boolean;
  animationType?: BarAnimationType;
  /** Gap between bars within the same category, in pixels. */
  barGap?: number;
  /** Gap between categories of bars, in pixels. */
  barCategoryGap?: number;
  defaultSelectedDataKey?: string | null;
  onSelectionChange?: (key: string | null) => void;
  /**
   * Colours ONLY the tallest column and mutes the rest. With several series the
   * comparison is per COLUMN — the totals across every series at that category —
   * so a whole stack or group lights up together, not one bar inside it.
   */
  enableMaxValueHighlight?: boolean;
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
  /** Corner radius — falls back to the root barRadius. */
  radius?: number;
  animationType?: BarAnimationType;
  isClickable?: boolean;
  /** Dims the other bars while one is hovered. */
  enableHoverHighlight?: boolean;
  glowing?: boolean;
  /** Renders the last data point as a hatched "buffer" bar. */
  bufferBar?: boolean;
}

export interface XAxisProps {
  /** Category key — overrides the root xDataKey (vertical layout). */
  dataKey?: string;
  tickFormatter?: (value: string, index: number) => string;
  label?: string;
  hideDots?: boolean;
}

export interface YAxisProps {
  /** Category key — overrides the root xDataKey (horizontal layout). */
  dataKey?: string;
  tickFormatter?: (value: string, index: number) => string;
  label?: string;
  hideDots?: boolean;
}

export interface TooltipProps {
  variant?: TooltipVariant;
  roundness?: TooltipRoundness;
  /** Data index the tooltip shows by default, with no hover. */
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

export type BarSeriesConfig = {
  dataKey: string;
  variant: BarVariant;
  radius?: number;
  animationType?: BarAnimationType;
  isClickable: boolean;
  enableHoverHighlight: boolean;
  glowing: boolean;
  bufferBar: boolean;
};

/**
 * One axis slot. Which physical axis renders it depends on `layout`, so unlike
 * line/area this chart keeps a single shape for both and swaps the roles.
 */
export type AxisSlot = {
  present: boolean;
  dataKey?: string;
  tickFormatter?: (value: string, index: number) => string;
  label?: string;
  hideDots: boolean;
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

export type BrushSlot = {
  present: boolean;
  height?: number;
  formatLabel?: (value: string, index: number) => string;
  onChange?: (range: { startIndex: number; endIndex: number }) => void;
};

export type CollectedConfig = {
  bars: BarSeriesConfig[];
  xAxis: AxisSlot;
  yAxis: AxisSlot;
  showGrid: boolean;
  tooltip: TooltipSlot;
  legend: LegendSlot;
  brush: BrushSlot;
};
