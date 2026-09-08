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
 * Pie chart — public types, slot shapes, and tuning constants.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-pie-chart.tsx` (MIT).
 *
 * The first NON-CARTESIAN chart. It shares the token, tooltip and legend layers
 * with line/area/bar and almost nothing else: no axes, no grid, no brush, no
 * dataZoom. What it adds is sector geometry, a decorative SVG background layer,
 * and an angular loading shimmer.
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

/** The subset of ECharts' pie itemStyle this chart writes. */
export type PieItemStyle = {
  color: string | object;
  opacity: number;
  borderRadius: number;
  borderColor?: string;
  borderWidth?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Intro draw-in length. The entrance is ECharts' RAW default pie animation
 * (`expansion` — sectors sweep out from the start angle); only whether it plays
 * is gated, matching the area chart's "raw default" policy.
 */
export const REVEAL_DURATION = 1000;
export const LOADING_ANIMATION_DURATION = 2000;
/** Skeleton sector count — the Recharts twin uses 5 equal sectors. */
export const LOADING_SECTORS = 5;

export const DEFAULT_INNER_RADIUS: number | string = 0;
export const DEFAULT_OUTER_RADIUS: number | string = "80%";
export const DEFAULT_CORNER_RADIUS = 0;
export const DEFAULT_PADDING_ANGLE = 0;
export const DEFAULT_START_ANGLE = 0;
export const DEFAULT_END_ANGLE = 360;

/**
 * Overlapping sectors (negative paddingAngle) get a background-coloured border
 * to separate the petals — the canvas analogue of the Recharts twin's
 * `stroke="var(--background)" strokeWidth={5}`.
 */
export const OVERLAP_BORDER_WIDTH = 5;

/**
 * Selecting a sector pops it radially OUTWARD from the centre — the offset-slice
 * look. This is the pixel distance the chosen sector translates along its own
 * bisector; deselecting returns it.
 */
export const SELECTED_OFFSET = 12;

/**
 * The selected sector stays fully opaque; the others recede to this. Tuned to
 * ~half the area chart's dim so the selected sector reads with more contrast.
 */
export const DIMMED_OPACITY = 0.15;

/** Resting skeleton sector fill, × foreground alpha. */
export const LOADING_BASE_OPACITY = 0.15;
/** Skeleton fill inside the sweep window, × foreground alpha. */
export const LOADING_PEAK_OPACITY = 0.5;
/** Window half-width, as a fraction of the ring (0..1). */
export const LOADING_SHIMMER_BAND = 0.28;
/** Sine-eased edge softening of the window. */
export const LOADING_SHIMMER_FEATHER = 0.22;

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The pie has a single fill style — a per-sector colour gradient. Kept as a
 * named union for API parity with the Recharts twin, and room to grow.
 */
export type PieVariant = "gradient";

/**
 * Where sector labels sit. "inside" draws value text on the sector; "outside"
 * moves the sector's name past the rim with a leader line.
 */
export type LabelPosition = "inside" | "outside";

export interface EChartsPieChartProps<TData extends Record<string, unknown>> {
  /** Rows rendered by the chart — one sector each. */
  data: TData[];
  /** Sector colours + labels, keyed by the sector NAME (not a series key). */
  config: ChartConfig;
  /** Key holding each sector's numeric value. */
  dataKey: keyof TData & string;
  /** Key holding each sector's name. */
  nameKey: keyof TData & string;
  class?: string;
  renderer?: EChartsRenderer;
  /** Master switch for the intro draw-in. OS reduce-motion also disables it. */
  animation?: boolean;
  defaultSelectedSector?: string | null;
  /** Controlled selection — overrides internal state when provided. */
  selectedSector?: string | null;
  onSelectionChange?: (selection: { dataKey: string; value: number } | null) => void;
  isLoading?: boolean;
  chartOptions?: Record<string, unknown>;
  children?: JSX.Element;
}

// ─────────────────────────────────────────────────────────────────────────────
// Marker props
// ─────────────────────────────────────────────────────────────────────────────

export interface PieProps {
  variant?: PieVariant;
  /** Set above 0 for a donut. */
  innerRadius?: number | string;
  outerRadius?: number | string;
  cornerRadius?: number;
  /** Gap between sectors in degrees — NEGATIVE overlaps them. */
  paddingAngle?: number;
  startAngle?: number;
  endAngle?: number;
  /** Lets sectors be selected by clicking — the selected one pops outward. */
  isClickable?: boolean;
  children?: JSX.Element;
}

export interface LabelProps {
  /** Data key for the label text — defaults by position. */
  dataKey?: string;
  position?: LabelPosition;
}

export interface TooltipProps {
  variant?: TooltipVariant;
  roundness?: TooltipRoundness;
  /** Sector index shown by default with no hover. */
  defaultIndex?: number;
  position?: TooltipPosition;
}

export interface LegendProps {
  variant?: LegendVariant;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  isClickable?: boolean;
}

export interface BackgroundProps {
  variant?: BackgroundVariant;
}

// ─────────────────────────────────────────────────────────────────────────────
// Collected slot shapes
// ─────────────────────────────────────────────────────────────────────────────

export type PieSlot = {
  variant: PieVariant;
  innerRadius: number | string;
  outerRadius: number | string;
  cornerRadius: number;
  paddingAngle: number;
  startAngle: number;
  endAngle: number;
  isClickable: boolean;
  /** `null` when no `<Label>` child is present; `""` means "use the default key". */
  labelDataKey: string | null;
  labelPosition: LabelPosition;
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

export type BackgroundSlot = { present: boolean; variant: BackgroundVariant };

export type CollectedConfig = {
  pie: PieSlot | null;
  tooltip: TooltipSlot;
  legend: LegendSlot;
  background: BackgroundSlot;
};
