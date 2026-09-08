/**
 * Sankey chart — public types, slot shapes, and tuning constants.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-sankey-chart.tsx` (MIT).
 *
 * The structural outlier of the set. It shares the token and tooltip layers and
 * nothing else: no axes, no polar system, no legend, and a data shape of its own
 * (`{ nodes, links }` rather than an array of rows).
 */
import type { JSX } from "solid-js";

import type { ChartConfig } from "../../lib/chart-tokens";
import type { EChartsRenderer } from "../../lib/echarts-paint";
import type {
  TooltipPosition,
  TooltipRoundness,
  TooltipVariant,
} from "../../lib/echarts-tooltip";

export type {
  ChartConfig,
  EChartsRenderer,
  TooltipPosition,
  TooltipRoundness,
  TooltipVariant,
};

// ─────────────────────────────────────────────────────────────────────────────
// Intro cascade timing
// ─────────────────────────────────────────────────────────────────────────────

/** Delay between one column and the next. */
export const INTRO_COLUMN_STAGGER = 130;
/** A single node opening from its centre. */
export const INTRO_NODE_GROW = 340;
/** Head start a column's nodes get over their bands. */
export const INTRO_LINK_DELAY = 90;
/** A band drawing from its source to its target. */
export const INTRO_LINK_DRAW = 520;
/** Softening on the growing/drawing edge, in gradient offset. */
export const INTRO_FEATHER = 0.05;
/** A node opens from this fraction of its height, not from nothing. */
export const INTRO_NODE_SCALE_FROM = 0.8;

export const LOADING_ANIMATION_DURATION = 2000;

export const DEFAULT_NODE_WIDTH = 10;
export const DEFAULT_NODE_PADDING = 10;
export const DEFAULT_LINK_CURVATURE = 0.5;
export const DEFAULT_ITERATIONS = 32;

// ─────────────────────────────────────────────────────────────────────────────
// Opacities
// ─────────────────────────────────────────────────────────────────────────────

/** Resting/selected node rectangle — the bold, opaque element. */
export const NODE_FILL_OPACITY = 1;
/** Node not connected to the current selection. */
export const NODE_DIM_OPACITY = 0.3;
/** Resting link band — the translucent fill base. */
export const LINK_FILL_OPACITY = 0.4;
/** Link not touching the selection — the band recedes further than a node does. */
export const LINK_DIM_OPACITY = 0.05;
/** Node label faded when its node is dimmed. */
export const LABEL_DIM_OPACITY = 0.3;
/** Inside-label plate fill, × background alpha. */
export const INSIDE_PLATE_ALPHA = 0.55;
/** Coloured rim around the inside-label plate, in pixels. */
export const INSIDE_RIM_WIDTH = 1;

/** Skeleton node fill outside the sweep, × foreground alpha. */
export const LOADING_NODE_FLOOR = 0.1;
/** Skeleton node fill inside the sweep. */
export const LOADING_NODE_PEAK = 0.42;
/** Skeleton link fill outside the sweep. */
export const LOADING_LINK_FLOOR = 0.04;
/** Skeleton link fill inside the sweep. */
export const LOADING_LINK_PEAK = 0.16;
/** Sweep half-width, fraction of chart width. */
export const LOADING_SHIMMER_BAND = 0.22;
/** Eased edge softening of the sweep. */
export const LOADING_SHIMMER_FEATHER = 0.22;

/** A fixed three-column graph for the loading skeleton. */
export const SKELETON_NODES = [
  { name: "s0" },
  { name: "s1" },
  { name: "s2" },
  { name: "m0" },
  { name: "m1" },
  { name: "m2" },
  { name: "e0" },
  { name: "e1" },
];

export const SKELETON_LINKS = [
  { source: "s0", target: "m0", value: 8 },
  { source: "s0", target: "m1", value: 5 },
  { source: "s1", target: "m1", value: 7 },
  { source: "s1", target: "m2", value: 4 },
  { source: "s2", target: "m1", value: 5 },
  { source: "s2", target: "m2", value: 6 },
  { source: "m0", target: "e0", value: 7 },
  { source: "m1", target: "e0", value: 9 },
  { source: "m1", target: "e1", value: 6 },
  { source: "m2", target: "e1", value: 8 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type LinkVariant = "gradient" | "solid" | "source" | "target";
export type NodeLabelPosition = "inside" | "outside";

/**
 * A sankey has no directional draw-in — its entrance follows the graph, not an
 * axis. "default" plays the column cascade, "none" turns it off.
 */
export type SankeyAnimationType = "none" | "default";

export type SankeyNode = {
  name: string;
  /**
   * Mirrors the Recharts twin's data shape for source compatibility. Canvas
   * cannot mount a component, so it is accepted and NOT rendered.
   */
  icon?: JSX.Element;
};

/** `source`/`target` are INDICES into `nodes`, matching the Recharts contract. */
export type SankeyLink = {
  source: number;
  target: number;
  value: number;
};

export type SankeyData = {
  nodes: SankeyNode[];
  links: SankeyLink[];
};

export interface EChartsSankeyChartProps {
  data: SankeyData;
  /** Node colours + labels, keyed by node NAME. */
  config: ChartConfig;
  children: JSX.Element;
  class?: string;
  renderer?: EChartsRenderer;
  nodeWidth?: number;
  /** Vertical gap between nodes — ECharts' nodeGap. */
  nodePadding?: number;
  /** 0 (straight) to 1 (maximum). */
  linkCurvature?: number;
  iterations?: number;
  /**
   * Mirrors the Recharts twin's prop surface but has no ECharts equivalent — the
   * sankey layout always sorts. Accepted and ignored.
   */
  sort?: boolean;
  /** Horizontal node alignment — ECharts' nodeAlign. */
  align?: "left" | "justify";
  /** Also has no ECharts equivalent; accepted and ignored. */
  verticalAlign?: "justify" | "top";
  defaultSelectedNode?: string | null;
  onSelectionChange?: (selection: { dataKey: string; value: number } | null) => void;
  isLoading?: boolean;
  animation?: boolean;
  animationType?: SankeyAnimationType;
  chartOptions?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Marker props
// ─────────────────────────────────────────────────────────────────────────────

export interface NodeProps {
  radius?: number;
  isClickable?: boolean;
  children?: JSX.Element;
}

export interface NodeLabelProps {
  position?: NodeLabelPosition;
  showValues?: boolean;
  valueFormatter?: (value: number) => string;
}

export interface LinkProps {
  variant?: LinkVariant;
  /** Reserved for parity with the Recharts twin. */
  verticalPadding?: number;
}

export interface TooltipProps {
  variant?: TooltipVariant;
  roundness?: TooltipRoundness;
  position?: TooltipPosition;
  /** Reserved for parity with the Recharts twin. */
  defaultIndex?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Collected slot shapes
// ─────────────────────────────────────────────────────────────────────────────

export type NodeSlot = { radius: number; isClickable: boolean };

export type NodeLabelSlot = {
  /** `undefined` → no labels at all, like the Recharts twin. */
  position?: NodeLabelPosition;
  showValues: boolean;
  valueFormatter?: (value: number) => string;
};

export type LinkSlot = { variant: LinkVariant; verticalPadding: number };

export type TooltipSlot = {
  present: boolean;
  variant: TooltipVariant;
  roundness: TooltipRoundness;
  position: TooltipPosition;
  defaultIndex?: number;
};

export type CollectedConfig = {
  node: NodeSlot;
  nodeLabel: NodeLabelSlot | null;
  link: LinkSlot;
  tooltip: TooltipSlot;
};

/** Milliseconds since the intro started, plus each node's column index. */
export type IntroState = {
  elapsed: number;
  depths: Record<string, number>;
};
