/**
 * Sankey chart — pure option builders, plus the intro cascade's paint maths.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-sankey-chart.tsx` (MIT).
 */
import { SankeyChart, type SankeySeriesOption } from "echarts/charts";
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
  DEFAULT_ITERATIONS,
  DEFAULT_LINK_CURVATURE,
  DEFAULT_NODE_PADDING,
  DEFAULT_NODE_WIDTH,
  INSIDE_PLATE_ALPHA,
  INSIDE_RIM_WIDTH,
  INTRO_COLUMN_STAGGER,
  INTRO_FEATHER,
  INTRO_LINK_DELAY,
  INTRO_LINK_DRAW,
  INTRO_NODE_GROW,
  INTRO_NODE_SCALE_FROM,
  LABEL_DIM_OPACITY,
  LINK_DIM_OPACITY,
  LINK_FILL_OPACITY,
  LOADING_SHIMMER_BAND,
  LOADING_SHIMMER_FEATHER,
  NODE_DIM_OPACITY,
  NODE_FILL_OPACITY,
  SKELETON_LINKS,
  SKELETON_NODES,
  type IntroState,
  type LinkSlot,
  type LinkVariant,
  type NodeLabelSlot,
  type NodeSlot,
  type SankeyData,
  type TooltipSlot,
} from "./types";

echarts.use([SankeyChart, TooltipComponent]);

export type EChartsOption = ComposeOption<SankeySeriesOption | TooltipComponentOption>;

type SankeyNodeItem = NonNullable<SankeySeriesOption["data"]>[number];
type SankeyEdgeItem = NonNullable<SankeySeriesOption["links"]>[number];

export type Paint = string | echarts.graphic.LinearGradient;

export type OptionBuildContext = {
  data: SankeyData;
  config: ChartConfig;
  nodeConfig: NodeSlot;
  nodeLabel: NodeLabelSlot | null;
  linkConfig: LinkSlot;
  tooltipSlot: TooltipSlot;
  selectedNode: string | null;
  nodeWidth: number;
  nodePadding: number;
  linkCurvature: number;
  iterations: number;
  align: "left" | "justify";
  isLoading: boolean;
  resolved: ResolvedColors;
  nodeValues: Record<string, number>;
  /** Reserves horizontal padding for outside labels. */
  outsideLabels: boolean;
  /** Mid-entrance cascade; null once the diagram is fully drawn. */
  intro: IntroState | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Paints
// ─────────────────────────────────────────────────────────────────────────────

export function nodeGradient(slots: string[]): Paint {
  if (slots.length <= 1) return slots[0] ?? FALLBACK_SERIES_COLOR;
  const stops = slots.map((color, i) => ({ offset: i / (slots.length - 1), color }));
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, stops);
}

/**
 * A link band's fill. `gradient` bakes the twin's 0.2/0.5/0.2 source→target stop
 * alphas into the colour; `source`/`target` reuse the node's vertical gradient;
 * `solid` is the foreground token. The connected/dimmed alpha is applied
 * separately as `lineStyle.opacity`.
 */
export function edgeColor(
  variant: LinkVariant,
  sourceSlots: string[],
  targetSlots: string[],
  foreground: string,
): Paint {
  switch (variant) {
    case "gradient": {
      const source = sourceSlots[0] ?? FALLBACK_SERIES_COLOR;
      const target = targetSlots[0] ?? FALLBACK_SERIES_COLOR;
      return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
        { offset: 0, color: withAlpha(source, 0.2) },
        { offset: 0.5, color: withAlpha(source, 0.5) },
        { offset: 1, color: withAlpha(target, 0.2) },
      ]);
    }
    case "source":
      return nodeGradient(sourceSlots);
    case "target":
      return nodeGradient(targetSlots);
    case "solid":
    default:
      return foreground;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Intro reveal — timing and paint
//
// The entrance is a windowed ALPHA on the same paint the element already uses.
// A node's fill runs vertically, so a window opening from offset 0.5 makes it
// grow from its centre; a link's gradient runs horizontally across its own
// bounding box — which spans exactly source edge → target edge — so a window
// sweeping 0 → 1 makes the band draw out of its source node.
//
// Nothing about the LAYOUT moves, so no frame re-runs the sankey solver on
// different geometry. That is the whole reason it is done this way.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Column index per node: the longest path from any source, which is what puts a
 * node in a later column than everything feeding it. Edges are relaxed until a
 * pass changes nothing; the node-count cap keeps a cyclic graph from spinning.
 */
export function computeNodeDepths(data: SankeyData): Record<string, number> {
  const nameOf = (ref: number) => data.nodes[ref]?.name ?? String(ref);
  const depths: Record<string, number> = {};
  for (const node of data.nodes) depths[node.name] = 0;

  for (let pass = 0; pass < data.nodes.length; pass++) {
    let changed = false;
    for (const link of data.links) {
      const source = nameOf(link.source);
      const target = nameOf(link.target);
      if (depths[target] === undefined || depths[source] === undefined) continue;
      if (depths[target]! < depths[source]! + 1) {
        depths[target] = depths[source]! + 1;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return depths;
}

/**
 * How long the whole cascade runs: whichever finishes last, the final column of
 * nodes or the bands leaving the column before it.
 */
export function introDuration(depths: Record<string, number>): number {
  const maxDepth = Math.max(0, ...Object.values(depths));
  return Math.max(
    maxDepth * INTRO_COLUMN_STAGGER + INTRO_NODE_GROW,
    Math.max(0, maxDepth - 1) * INTRO_COLUMN_STAGGER + INTRO_LINK_DELAY + INTRO_LINK_DRAW,
  );
}

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export function nodePhase(intro: IntroState, name: string): number {
  const start = (intro.depths[name] ?? 0) * INTRO_COLUMN_STAGGER;
  return easeOut(clamp01((intro.elapsed - start) / INTRO_NODE_GROW));
}

/** Keys off the SOURCE node's column, so a band never starts before its node. */
export function linkPhase(intro: IntroState, sourceName: string): number {
  const start =
    (intro.depths[sourceName] ?? 0) * INTRO_COLUMN_STAGGER + INTRO_LINK_DELAY;
  return easeOut(clamp01((intro.elapsed - start) / INTRO_LINK_DRAW));
}

/** "y" for a node's vertical gradient, "x" for a link's, null for a flat colour. */
export function paintAxis(paint: Paint): "x" | "y" | null {
  if (typeof paint === "string") return null;
  const horizontal = Math.abs((paint.x2 ?? 0) - (paint.x ?? 0));
  const vertical = Math.abs((paint.y2 ?? 0) - (paint.y ?? 0));
  return horizontal >= vertical ? "x" : "y";
}

export function paintStops(paint: Paint): { offset: number; color: string }[] {
  if (typeof paint === "string") {
    return [
      { offset: 0, color: paint },
      { offset: 1, color: paint },
    ];
  }
  const stops = paint.colorStops ?? [];
  if (stops.length === 0) return [{ offset: 0, color: FALLBACK_SERIES_COLOR }];
  return stops.map((stop) => ({ offset: stop.offset, color: stop.color }));
}

/**
 * The paint's colour at an arbitrary offset, so a window edge inserted between
 * two stops keeps the hue it interrupts.
 */
export function sampleStops(
  stops: { offset: number; color: string }[],
  at: number,
): string {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return FALLBACK_SERIES_COLOR;
  if (at <= first.offset) return first.color;
  if (at >= last.offset) return last.color;
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1]!;
    const to = stops[i]!;
    if (at > to.offset) continue;
    const span = to.offset - from.offset;
    if (span <= 1e-6) return to.color;
    return (
      echarts.color.lerp((at - from.offset) / span, [from.color, to.color]) || from.color
    );
  }
  return last.color;
}

/**
 * Multiplies a paint's alpha by a trapezoid window along `axis`: transparent
 * before `edges[0]`, opaque between `edges[1]` and `edges[2]`, transparent again
 * after `edges[3]`.
 *
 * Returns null when the paint runs along the OTHER axis with real colour
 * variation — two axes can't be composed into one canvas gradient, so the caller
 * falls back to a plain fade for that rare case.
 */
export function windowedPaint(
  paint: Paint,
  axis: "x" | "y",
  edges: [number, number, number, number],
): Paint | null {
  const own = paintAxis(paint);
  if (own !== null && own !== axis) return null;

  const stops = paintStops(paint);
  const alphaAt = (offset: number) => {
    if (offset <= edges[0] || offset >= edges[3]) return 0;
    if (offset >= edges[1] && offset <= edges[2]) return 1;
    if (offset < edges[1]) return (offset - edges[0]) / Math.max(1e-6, edges[1] - edges[0]);
    return (edges[3] - offset) / Math.max(1e-6, edges[3] - edges[2]);
  };

  const offsets = [...new Set([0, 1, ...stops.map((stop) => stop.offset), ...edges])]
    .filter((offset) => offset >= 0 && offset <= 1)
    .sort((a, b) => a - b);
  const windowed = offsets.map((offset) => ({
    offset,
    color: withAlpha(sampleStops(stops, offset), alphaAt(offset)),
  }));

  return axis === "x"
    ? new echarts.graphic.LinearGradient(0, 0, 1, 0, windowed)
    : new echarts.graphic.LinearGradient(0, 0, 0, 1, windowed);
}

/**
 * A node scaling up about its own centre: it starts at INTRO_NODE_SCALE_FROM of
 * full height and opens to 1 — a short pop rather than a wipe from nothing.
 */
export function growPaint(paint: Paint, phase: number): Paint | null {
  const half = (INTRO_NODE_SCALE_FROM + (1 - INTRO_NODE_SCALE_FROM) * phase) / 2;
  return windowedPaint(paint, "y", [
    0.5 - half - INTRO_FEATHER,
    0.5 - half,
    0.5 + half,
    0.5 + half + INTRO_FEATHER,
  ]);
}

/** A band drawing from its source edge toward its target edge. */
export function drawPaint(paint: Paint, phase: number): Paint | null {
  const head = phase * (1 + INTRO_FEATHER);
  return windowedPaint(paint, "x", [-2, -1, head - INTRO_FEATHER, head]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Selection + values
// ─────────────────────────────────────────────────────────────────────────────

/** The selected node plus every node one link away from it. */
export function connectedNodeSet(data: SankeyData, selected: string): Set<string> {
  const set = new Set<string>([selected]);
  const selectedIdx = data.nodes.findIndex((node) => node.name === selected);
  if (selectedIdx === -1) return set;

  for (const link of data.links) {
    if (link.source === selectedIdx) {
      const name = data.nodes[link.target]?.name;
      if (name) set.add(name);
    } else if (link.target === selectedIdx) {
      const name = data.nodes[link.source]?.name;
      if (name) set.add(name);
    }
  }
  return set;
}

/**
 * Each node's total flow: outgoing sum, falling back to incoming for leaf nodes
 * — the same value the twin surfaces in labels, the tooltip, and the callback.
 */
export function computeNodeValues(data: SankeyData): Record<string, number> {
  const values: Record<string, number> = {};
  data.nodes.forEach((node, index) => {
    let outgoing = 0;
    let incoming = 0;
    for (const link of data.links) {
      if (link.source === index) outgoing += link.value;
      if (link.target === index) incoming += link.value;
    }
    values[node.name] = outgoing > 0 ? outgoing : incoming;
  });
  return values;
}

/**
 * A hard clip window swept across the fixed skeleton. `floor` keeps the geometry
 * faintly visible between sweeps; `peak` is the bright band.
 */
export function shimmerWindowStops(
  center: number,
  color: string,
  floor: number,
  peak: number,
) {
  const half = LOADING_SHIMMER_BAND;
  const feather = LOADING_SHIMMER_FEATHER;

  const alphaAt = (x: number) => {
    const dist = Math.abs(x - center);
    if (dist <= half - feather) return peak;
    if (dist >= half) return floor;
    const t = 1 - (dist - (half - feather)) / feather;
    return floor + (peak - floor) * Math.sin((t * Math.PI) / 2);
  };

  const offsets = [
    0,
    center - half,
    center - half + feather,
    center,
    center + half - feather,
    center + half,
    1,
  ]
    .filter((x) => x >= 0 && x <= 1)
    .sort((a, b) => a - b);

  const stops: { offset: number; color: string }[] = [];
  for (const offset of offsets) {
    const last = stops[stops.length - 1];
    if (!last || offset - last.offset > 1e-4) {
      stops.push({ offset, color: withAlpha(color, alphaAt(offset)) });
    }
  }
  return stops;
}

// ─────────────────────────────────────────────────────────────────────────────
// Label
// ─────────────────────────────────────────────────────────────────────────────

export function buildNodeLabel(ctx: OptionBuildContext): SankeySeriesOption["label"] {
  const { nodeLabel, config, nodeValues, resolved } = ctx;
  const position = nodeLabel?.position;

  // No <NodeLabel>, or one with no position, shows nothing — Recharts parity.
  if (position !== "inside" && position !== "outside") return { show: false };

  const { tokens } = resolved;
  const inside = position === "inside";
  const showValues = nodeLabel?.showValues ?? false;
  const format = nodeLabel?.valueFormatter ?? ((value: number) => value.toLocaleString());

  const labelOf = (name: string) => {
    const label = config[name]?.label;
    return typeof label === "string" ? label : name;
  };

  const formatter = (params: unknown): string => {
    const name = String((params as { name?: string | number }).name ?? "");
    const nameText = labelOf(name);
    if (!showValues) return `{name|${nameText}}`;
    return `{name|${nameText}}\n{value|${format(nodeValues[name] ?? 0)}}`;
  };

  return {
    show: true,
    position: inside ? "inside" : "right",
    align: inside ? "center" : "left",
    formatter,
    rich: {
      name: {
        color: tokens.foreground,
        fontSize: inside ? 10 : 12,
        fontWeight: 500,
        lineHeight: 15,
      },
      value: {
        color: withAlpha(tokens.foreground, inside ? 0.6 : 0.5),
        fontFamily: "monospace",
        fontSize: inside ? 11 : 12,
        lineHeight: 15,
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Series
// ─────────────────────────────────────────────────────────────────────────────

export function buildSankeySeries(ctx: OptionBuildContext): SankeySeriesOption {
  const {
    config,
    data,
    nodeConfig,
    linkConfig,
    selectedNode,
    nodeWidth,
    nodePadding,
    linkCurvature,
    iterations,
    align,
    resolved,
    outsideLabels,
    intro,
  } = ctx;
  const { tokens, series: slotsByName } = resolved;
  const hasSelection = selectedNode !== null;
  const connected = hasSelection ? connectedNodeSet(data, selectedNode) : null;
  // With inside labels the node is rebuilt as a card: a translucent plate fills
  // the whole rect and the node's own colour shows only as a rounded rim, with
  // the __sankey-plate series tinting through from behind.
  const insideLabels = ctx.nodeLabel?.position === "inside";

  // Nodes with no INCOMING link start the diagram, so an outside label reads on
  // their LEFT. Without the split, the first column's text lands straight on its
  // own outgoing bands.
  const targetNames = new Set(
    data.links.map((link) => data.nodes[link.target]?.name ?? String(link.target)),
  );

  const nodes: SankeyNodeItem[] = data.nodes.map((node) => {
    const slots = slotsByName[node.name] ?? [FALLBACK_SERIES_COLOR];
    const dimmed = connected ? !connected.has(node.name) : false;
    const phase = intro ? nodePhase(intro, node.name) : 1;
    const fill = nodeGradient(slots);
    const grown = phase < 1 ? growPaint(fill, phase) : fill;
    const nodeAlpha = (dimmed ? NODE_DIM_OPACITY : NODE_FILL_OPACITY) * phase;

    return {
      name: node.name,
      itemStyle: insideLabels
        ? {
            color: withAlpha(tokens.background, INSIDE_PLATE_ALPHA * phase),
            borderColor: grown ?? fill,
            borderWidth: INSIDE_RIM_WIDTH,
            borderRadius: nodeConfig.radius,
            opacity: (dimmed ? NODE_DIM_OPACITY : 1) * phase,
          }
        : {
            color: grown ?? fill,
            opacity: nodeAlpha,
            borderWidth: 0,
            borderRadius: nodeConfig.radius,
          },
      label: {
        // An EMPTY config label opts a node out entirely — a pass-through hub
        // carries its total in the surrounding layout, not on the node.
        ...(config[node.name]?.label === "" ? { show: false } : {}),
        opacity: (dimmed ? LABEL_DIM_OPACITY : 1) * phase,
        ...(outsideLabels && !targetNames.has(node.name)
          ? { position: "left" as const, align: "right" as const }
          : {}),
      },
    };
  });

  const links: SankeyEdgeItem[] = data.links.map((link) => {
    const source = data.nodes[link.source]?.name ?? String(link.source);
    const target = data.nodes[link.target]?.name ?? String(link.target);
    const sourceSlots = slotsByName[source] ?? [FALLBACK_SERIES_COLOR];
    const targetSlots = slotsByName[target] ?? [FALLBACK_SERIES_COLOR];
    const isConnected =
      !hasSelection || source === selectedNode || target === selectedNode;
    const phase = intro ? linkPhase(intro, source) : 1;
    const band = edgeColor(linkConfig.variant, sourceSlots, targetSlots, tokens.foreground);
    const drawn = phase < 1 ? drawPaint(band, phase) : band;

    return {
      source,
      target,
      value: link.value,
      lineStyle: {
        color: drawn ?? band,
        // When windowedPaint bailed (drawn === null) the band can't be clipped,
        // so it falls back to a plain fade via the phase multiplier instead.
        opacity: (isConnected ? LINK_FILL_OPACITY : LINK_DIM_OPACITY) * (drawn ? 1 : phase),
      },
    };
  });

  return {
    id: "__sankey",
    type: "sankey",
    z: 3,
    // Outside labels hang past the outermost columns on BOTH sides.
    left: outsideLabels ? 120 : 8,
    right: outsideLabels ? 120 : 8,
    top: 12,
    bottom: 12,
    nodeWidth,
    nodeGap: nodePadding,
    layoutIterations: iterations,
    nodeAlign: align === "left" ? "left" : "justify",
    draggable: false,
    // The twin has no hover-dimming — hovering only shows the tooltip.
    emphasis: { focus: "none" },
    lineStyle: { curveness: linkCurvature },
    label: buildNodeLabel(ctx),
    data: nodes,
    links,
  };
}

/**
 * The coloured card drawn UNDER the inside-label plate.
 *
 * With inside labels the real node's fill becomes a translucent plate, so this
 * silent duplicate — identical layout, pixel-exact beneath — supplies the node's
 * actual colour behind it. Returns null unless inside labels are active, so the
 * extra series is only paid for on demand.
 */
export function buildInsidePlateSeries(
  ctx: OptionBuildContext,
): SankeySeriesOption | null {
  const {
    data,
    nodeConfig,
    nodeLabel,
    selectedNode,
    nodeWidth,
    nodePadding,
    linkCurvature,
    iterations,
    align,
    resolved,
    outsideLabels,
    intro,
  } = ctx;
  if (nodeLabel?.position !== "inside") return null;

  const { series: slotsByName } = resolved;
  const hasSelection = selectedNode !== null;
  const connected = hasSelection ? connectedNodeSet(data, selectedNode) : null;

  const nodes: SankeyNodeItem[] = data.nodes.map((node) => {
    const slots = slotsByName[node.name] ?? [FALLBACK_SERIES_COLOR];
    const dimmed = connected ? !connected.has(node.name) : false;
    // Grows in step with the real node above it — card and plate are one element
    // to the eye, so they must open together.
    const phase = intro ? nodePhase(intro, node.name) : 1;
    const fill = nodeGradient(slots);
    const grown = phase < 1 ? growPaint(fill, phase) : fill;
    return {
      name: node.name,
      itemStyle: {
        color: grown ?? fill,
        opacity: (dimmed ? NODE_DIM_OPACITY : NODE_FILL_OPACITY) * phase,
        borderWidth: 0,
        borderRadius: nodeConfig.radius,
      },
      label: { show: false },
    };
  });

  // Links exist only so the layout matches the main series pixel-exact; they are
  // fully transparent here.
  const links: SankeyEdgeItem[] = data.links.map((link) => ({
    source: data.nodes[link.source]?.name ?? String(link.source),
    target: data.nodes[link.target]?.name ?? String(link.target),
    value: link.value,
    lineStyle: { opacity: 0 },
  }));

  return {
    id: "__sankey-plate",
    type: "sankey",
    z: 2, // below the real __sankey series (z: 3)
    silent: true,
    left: outsideLabels ? 120 : 8,
    right: outsideLabels ? 120 : 8,
    top: 12,
    bottom: 12,
    nodeWidth,
    nodeGap: nodePadding,
    layoutIterations: iterations,
    nodeAlign: align === "left" ? "left" : "justify",
    draggable: false,
    emphasis: { disabled: true },
    label: { show: false },
    lineStyle: { curveness: linkCurvature },
    data: nodes,
    links,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A sankey fires item events for BOTH nodes (`dataType: "node"`) and links
 * (`dataType: "edge"`), so the formatter renders a different row for each.
 */
export function createTooltipFormatter(ctx: OptionBuildContext) {
  const { config, nodeValues, tooltipSlot } = ctx;

  const labelOf = (name: string) => {
    const label = config[name]?.label;
    return typeof label === "string" ? label : name;
  };
  const colorsOf = (name: string) => (config[name] ? getColorsCount(config[name]!) : 1);
  const wrap = (body: string) =>
    `<div class="grid min-w-32 items-start gap-1.5 border border-border/50 px-2.5 py-1.5 text-xs shadow-xl ${roundnessClass[tooltipSlot.roundness]} ${tooltipVariantClass[tooltipSlot.variant]}"><div class="grid gap-1.5">${body}</div></div>`;

  return (params: unknown): string => {
    const p = params as {
      dataType?: string;
      name?: string;
      data?: { source?: string | number; target?: string | number; value?: number };
    };

    if (p.dataType === "edge") {
      const source = String(p.data?.source ?? "");
      const target = String(p.data?.target ?? "");
      const value =
        typeof p.data?.value === "number" ? p.data.value.toLocaleString() : "";
      return wrap(
        tooltipRow({
          indicatorHtml: tooltipIndicatorHtml(source, colorsOf(source)),
          labelText: `${labelOf(source)} → ${labelOf(target)}`,
          valueText: value,
          dimmed: "",
        }),
      );
    }

    const name = String(p.name ?? "");
    const value = (nodeValues[name] ?? 0).toLocaleString();
    return wrap(
      tooltipRow({
        indicatorHtml: tooltipIndicatorHtml(name, colorsOf(name)),
        labelText: labelOf(name),
        valueText: value,
        dimmed: "",
      }),
    );
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
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A FIXED grey sankey, invisible until the first shimmer tick tints it. Node and
 * link fills start as fully-transparent foreground so nothing flashes before the
 * rAF positions the sweep.
 */
export function buildLoadingOption(ctx: OptionBuildContext): EChartsOption {
  const { resolved } = ctx;
  const transparent = withAlpha(resolved.tokens.foreground, 0);

  return {
    animation: false,
    tooltip: { show: false },
    series: [
      {
        id: "__loading",
        type: "sankey",
        left: 12,
        right: 12,
        top: 12,
        bottom: 12,
        nodeWidth: DEFAULT_NODE_WIDTH,
        nodeGap: DEFAULT_NODE_PADDING,
        layoutIterations: DEFAULT_ITERATIONS,
        draggable: false,
        silent: true,
        emphasis: { disabled: true },
        label: { show: false },
        itemStyle: { color: transparent, borderWidth: 0 },
        lineStyle: { color: transparent, curveness: DEFAULT_LINK_CURVATURE },
        data: SKELETON_NODES,
        links: SKELETON_LINKS,
      },
    ],
  };
}
