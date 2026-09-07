/**
 * Line chart — the declarative config children, and the parser that walks them.
 *
 * Every part renders nothing; its PRESENCE and props are the configuration.
 * Presence semantics mirror the Recharts twin: omit a child and that part does
 * not render.
 *
 * React reads these back with `Children.forEach` + `child.type === Line`.
 * Solid has no element descriptors, so each marker returns a config object and
 * `collectConfig` resolves them — see ../../lib/slots.tsx.
 */
import { Brush, type BrushProps } from "../../lib/echarts-brush";
import type { DotVariant } from "../../lib/echarts-dot";
import { createMarker, filterSlots, findSlot, slotProps, slotsOf } from "../../lib/slots";
import {
  STROKE_WIDTH,
  type BrushSlot,
  type CollectedConfig,
  type DotProps,
  type LegendProps,
  type LegendSlot,
  type LineProps,
  type LineSeriesConfig,
  type TooltipProps,
  type TooltipSlot,
  type XAxisProps,
  type XAxisSlot,
  type YAxisProps,
  type YAxisSlot,
} from "./types";

/**
 * A single line series. Declares its own stroke/curve/glow/clickability and,
 * optionally, resting/active point markers via composed `<Dot>` / `<ActiveDot>`.
 */
export const Line = createMarker<"line", LineProps>("line");

/** Declares the resting point marker for the enclosing `<Line>`. */
export const Dot = createMarker<"dot", DotProps>("dot");

/** Declares the hovered/active point marker for the enclosing `<Line>`. */
export const ActiveDot = createMarker<"activeDot", DotProps>("activeDot");

/** Presence shows the x-axis category labels. */
export const XAxis = createMarker<"xAxis", XAxisProps>("xAxis");

/** Presence shows the y value axis. */
export const YAxis = createMarker<"yAxis", YAxisProps>("yAxis");

/** Presence shows the dashed horizontal split lines. */
export const Grid = createMarker<"grid", Record<string, never>>("grid");

/** Presence enables the hover tooltip. */
export const Tooltip = createMarker<"tooltip", TooltipProps>("tooltip");

/** Presence enables the HTML legend overlay. */
export const Legend = createMarker<"legend", LegendProps>("legend");

export { Brush };

/**
 * Walks the declarative config into plain objects the option builders consume.
 *
 * `<Dot>` / `<ActiveDot>` are read from each `<Line>`'s own children. Because a
 * marker renders nothing, Solid never resolves those nested children — reaching
 * them is this function's job.
 */
export function collectConfig(children: unknown): CollectedConfig {
  const slots = slotsOf(children);
  const lines: LineSeriesConfig[] = [];

  for (const slot of filterSlots(slots, "line")) {
    const props = slotProps<LineProps>(slot);

    const nested = slotsOf(props.children);
    const dot = findSlot(nested, "dot");
    const activeDot = findSlot(nested, "activeDot");
    const dotVariant: DotVariant = dot
      ? (slotProps<DotProps>(dot).variant ?? "default")
      : "none";
    const activeDotVariant: DotVariant = activeDot
      ? (slotProps<DotProps>(activeDot).variant ?? "default")
      : "none";

    lines.push({
      dataKey: props.dataKey,
      // The Recharts twin defaults a <Line> to a solid stroke (its <Area>
      // defaults to dashed — a divergence intentionally preserved here).
      strokeVariant: props.strokeVariant ?? "solid",
      strokeWidth: props.strokeWidth ?? STROKE_WIDTH,
      curveType: props.curveType,
      animationType: props.animationType,
      connectNulls: props.connectNulls ?? false,
      isClickable: props.isClickable ?? false,
      glowing: props.glowing ?? false,
      enableBufferLine: props.enableBufferLine ?? false,
      dotVariant,
      activeDotVariant,
    });
  }

  let xAxis: XAxisSlot = { present: false, hideDots: false };
  const xAxisSlot = findSlot(slots, "xAxis");
  if (xAxisSlot) {
    const props = slotProps<XAxisProps>(xAxisSlot);
    xAxis = {
      present: true,
      dataKey: props.dataKey,
      tickFormatter: props.tickFormatter,
      label: props.label,
      hideDots: props.hideDots ?? false,
    };
  }

  let yAxis: YAxisSlot = { present: false, hideDots: false };
  const yAxisSlot = findSlot(slots, "yAxis");
  if (yAxisSlot) {
    const props = slotProps<YAxisProps>(yAxisSlot);
    yAxis = {
      present: true,
      dataKey: props.dataKey,
      tickFormatter: props.tickFormatter,
      label: props.label,
      hideDots: props.hideDots ?? false,
    };
  }

  let tooltip: TooltipSlot = {
    present: false,
    variant: "default",
    roundness: "lg",
    cursor: true,
    position: "variable",
  };
  const tooltipSlot = findSlot(slots, "tooltip");
  if (tooltipSlot) {
    const props = slotProps<TooltipProps>(tooltipSlot);
    tooltip = {
      present: true,
      variant: props.variant ?? "default",
      roundness: props.roundness ?? "lg",
      cursor: props.cursor ?? true,
      position: props.position ?? "variable",
    };
  }

  let legend: LegendSlot = {
    present: false,
    variant: "rounded-square",
    align: "right",
    verticalAlign: "top",
    isClickable: false,
  };
  const legendSlot = findSlot(slots, "legend");
  if (legendSlot) {
    const props = slotProps<LegendProps>(legendSlot);
    legend = {
      present: true,
      variant: props.variant ?? "rounded-square",
      align: props.align ?? "right",
      verticalAlign: props.verticalAlign ?? "top",
      isClickable: props.isClickable ?? false,
    };
  }

  let brush: BrushSlot = { present: false };
  const brushSlot = findSlot(slots, "brush");
  if (brushSlot) {
    const props = slotProps<BrushProps>(brushSlot);
    brush = {
      present: true,
      height: props.height,
      formatLabel: props.formatLabel,
      onChange: props.onChange,
    };
  }

  return {
    lines,
    xAxis,
    yAxis,
    showGrid: findSlot(slots, "grid") !== undefined,
    tooltip,
    legend,
    brush,
  };
}
