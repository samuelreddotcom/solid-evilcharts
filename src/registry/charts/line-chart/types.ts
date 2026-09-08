import type { JSX } from "solid-js";

import type { ChartConfig } from "../../lib/chart-tokens";
import type { EChartsRenderer } from "../../lib/echarts-paint";
import type { DotVariant } from "../../lib/echarts-dot";
import type { LegendVariant } from "../../lib/echarts-legend";
import type {
  TooltipPosition,
  TooltipRoundness,
  TooltipVariant,
} from "../../lib/echarts-tooltip";

/**
 * Line chart — public types, slot shapes, and tuning constants.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-line-chart.tsx` (MIT).
 * That file is a single 2,111-line module; this port splits it into
 * types / parts / options / component. The registry ships multi-file items, and
 * the split keeps each piece reviewable.
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

/** Default series stroke — `<Line strokeWidth>` overrides it. */
export const STROKE_WIDTH = 0.8;
/** Shimmer loop length, in milliseconds. */
export const LOADING_ANIMATION_DURATION = 2000;
/**
 * Intro draw-in length, in milliseconds.
 *
 * The draw-in runs ECharts' RAW default entrance animation. Custom easing was
 * tried and abandoned upstream — ECharts hardcodes the line-entrance clip to
 * linear and ignores animationEasing at every level.
 */
export const REVEAL_DURATION = 1000;
export const LOADING_DEFAULT_POINTS = 14;
/**
 * Buffer line: the last segment renders as this dash while the rest stays
 * solid, echoing the Recharts twin's 4px dash / 3px gap forecast tail.
 */
export const BUFFER_DASH: [number, number] = [4, 3];

/**
 * `<Line glowing>` glow. Canvas has no SVG blur filter over a whole shape, so
 * the glow is built from SILENT, stacked copies of the line laid UNDER the real
 * one.
 *
 * The layers are all the SAME NARROW WIDTH on purpose. A wide translucent
 * stroke has a HARD edge, so widening each copy (the obvious approach) paints
 * concentric contour rings, not a glow — no number of layers hides it, because
 * every layer contributes another visible boundary. Here each copy stays hidden
 * beneath the real line and the visible halo comes entirely from its canvas
 * `shadowBlur`, which is a true gaussian: edgeless by construction, and summing
 * several at different radii stays perfectly smooth.
 *
 * The trade: a canvas shadow is a single flat colour, so the halo is cast in
 * the gradient's mid tone rather than tracking the stroke's colour along its
 * length. The stroke copies still carry the real gradient, so the bright core
 * reads correctly; only the soft bloom is one hue. `symbolPad` grows the glow
 * disc under each visible dot so haloed markers bloom too.
 */
export const GLOW_LAYERS: {
  width: number;
  opacity: number;
  blur: number;
  symbolPad: number;
}[] = [
  { width: 2, opacity: 0.9, blur: 5, symbolPad: 2 },
  { width: 2, opacity: 0.6, blur: 12, symbolPad: 6 },
  { width: 2, opacity: 0.38, blur: 24, symbolPad: 11 },
  { width: 2, opacity: 0.22, blur: 42, symbolPad: 16 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Theme knobs — every neutral line in the chart draws from these. Base colours
// come from the consumer's CSS tokens (resolved from the live DOM), so only the
// opacity factors live here. Factors MULTIPLY the token's own alpha — a border
// token that is already 10%-white stays subtle. Tune here, not in the builder.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dashed y-axis split lines, × border alpha.
 *
 * Recharts draws its grid at border/50, but SVG dashes render pixel-crisp while
 * canvas at 2× DPR spreads a 1px line across device pixels — roughly halving
 * perceived intensity. Using the border token's full alpha lands both engines
 * at the same apparent brightness.
 */
export const GRID_LINE_OPACITY = 1;
/** Tooltip cursor line, × border alpha. */
export const AXIS_POINTER_OPACITY = 1;
/** Skeleton outline inside the shimmer window, × foreground alpha. */
export const LOADING_STROKE_OPACITY = 0.5;
/** Shimmer window half-width, as a fraction of chart width. */
export const LOADING_SHIMMER_BAND = 0.2;
/** Eased edge softening of the shimmer clip window. */
export const LOADING_SHIMMER_FEATHER = 0.2;
/** Mini-chart series stroke (evil-brush "line" variant). */
export const BRUSH_STROKE_OPACITY = 0.5;
/** Selected-range wash — evil-brush draws none. */
export const BRUSH_FILLER_OPACITY = 0;

/**
 * Marks the dashed forecast overlay of a buffer line. It carries the SAME key's
 * value, so the tooltip recovers the key from it. Every other `__`-prefixed
 * series (mini chart, loading skeleton, hover-reveal base) is truly internal and
 * never surfaces.
 */
export const BUFFER_PREFIX = "__buffer-";
/** Marks the muted base layer of a hover-reveal line. Internal. */
export const REVEAL_PREFIX = "__reveal-";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type StrokeVariant = "solid" | "dashed" | "animated-dashed";

export type LineAnimationType =
  | "none"
  | "left-to-right"
  | "right-to-left"
  | "center-out"
  | "edges-in";

export type CurveType =
  | "linear"
  | "smooth"
  | "bump"
  | "monotone"
  | "monotoneX"
  | "monotoneY"
  | "natural"
  | "step";

export interface EChartsLineChartProps<TData extends Record<string, unknown>> {
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
  /** Default curve interpolation each `<Line>` inherits. */
  curveType?: CurveType;
  /** Master switch for the intro draw-in — false renders instantly. */
  animation?: boolean;
  /** Default intro reveal (the first `<Line>` overrides). */
  animationType?: LineAnimationType;
  /** Hovering a series dims the others, like a temporary selection. */
  enableHoverHighlight?: boolean;
  /** Hovering colours each line up to the pointer's x and mutes the rest. */
  enableHoverReveal?: boolean;
  /** Series selected on first render. */
  defaultSelectedDataKey?: string | null;
  /** Fires when the selected series changes. */
  onSelectionChange?: (key: string | null) => void;
  /** Shows the animated loading skeleton. */
  isLoading?: boolean;
  /** Number of points in the loading skeleton. */
  loadingPoints?: number;
  /** Escape hatch merged over the built ECharts option. */
  chartOptions?: Record<string, unknown>;
  /** Declarative config — `<Line>`, `<XAxis>`, `<Grid>`, `<Tooltip>`, … */
  children?: JSX.Element;
}

// ─────────────────────────────────────────────────────────────────────────────
// Marker props
// ─────────────────────────────────────────────────────────────────────────────

export interface LineProps {
  /** Series key — must exist on the data and config. */
  dataKey: string;
  strokeVariant?: StrokeVariant;
  strokeWidth?: number;
  /** Curve interpolation — falls back to the root curveType. */
  curveType?: CurveType;
  /** Intro reveal — the first line drives the wrapper wipe. */
  animationType?: LineAnimationType;
  /** Join segments across null/missing values. */
  connectNulls?: boolean;
  /** Lets this line be selected by clicking it. */
  isClickable?: boolean;
  /** Applies a soft outer glow. */
  glowing?: boolean;
  /** Renders this line's last segment as a dashed buffer. */
  enableBufferLine?: boolean;
  /** Optional `<Dot>` and `<ActiveDot>` config. */
  children?: JSX.Element;
}

export interface DotProps {
  variant?: DotVariant;
}

export interface XAxisProps {
  /** x category key — overrides the root xDataKey. */
  dataKey?: string;
  /**
   * Category-axis values are always stringified, so the formatter sees a string
   * — letting examples share `(value) => value.substring(0, 3)` with the
   * Recharts twin.
   */
  tickFormatter?: (value: string, index: number) => string;
  /** Axis title, centred below the tick labels. */
  label?: string;
  /** Hides the tick dots beside this axis's labels. */
  hideDots?: boolean;
}

export interface YAxisProps {
  /** Reserved for parity with the Recharts twin. */
  dataKey?: string;
  tickFormatter?: (value: number, index: number) => string;
  label?: string;
  hideDots?: boolean;
}

export interface TooltipProps {
  variant?: TooltipVariant;
  roundness?: TooltipRoundness;
  /** Whether the vertical cursor line follows the pointer. */
  cursor?: boolean;
  position?: TooltipPosition;
}

export interface LegendProps {
  variant?: LegendVariant;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  /** Lets each entry toggle selection of its series. */
  isClickable?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Collected slot shapes — what the parser hands the option builders
// ─────────────────────────────────────────────────────────────────────────────

export type LineSeriesConfig = {
  dataKey: string;
  strokeVariant: StrokeVariant;
  strokeWidth: number;
  curveType?: CurveType;
  animationType?: LineAnimationType;
  connectNulls: boolean;
  isClickable: boolean;
  glowing: boolean;
  enableBufferLine: boolean;
  /** "none" when no `<Dot>` child is present. */
  dotVariant: DotVariant;
  /** "none" when no `<ActiveDot>` child is present. */
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
  /** A `<Brush>` child was passed — presence turns the brush on. */
  present: boolean;
  height?: number;
  formatLabel?: (value: string, index: number) => string;
  onChange?: (range: { startIndex: number; endIndex: number }) => void;
};

export type CollectedConfig = {
  lines: LineSeriesConfig[];
  xAxis: XAxisSlot;
  yAxis: YAxisSlot;
  showGrid: boolean;
  tooltip: TooltipSlot;
  legend: LegendSlot;
  brush: BrushSlot;
};
