import { Brush, type BrushProps } from "../../lib/echarts-brush";
import type { DotVariant } from "../../lib/echarts-dot";
import { createMarker, filterSlots, findSlot, slotProps, slotsOf } from "../../lib/slots";
import {
  DEFAULT_BAR_RADIUS,
  type BarProps,
  type BarSeriesConfig,
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
 * Composed chart — the declarative config children, and the parser.
 *
 * The only chart with TWO series markers. `<Bar>` and `<Line>` are collected
 * into separate lists, and the option builder always emits bars first so the
 * polyline strokes read above the columns — matching the Recharts twin's JSX
 * order rather than the order they were declared in.
 */

/** A single bar series. Glows via a canvas shadow. */
export const Bar = createMarker<"bar", BarProps>("bar");

/** A single line series. Glows via stacked overlay copies. */
export const Line = createMarker<"line", LineProps>("line");

/** Declares the resting point marker for the enclosing `<Line>`. */
export const Dot = createMarker<"dot", DotProps>("dot");

/** Declares the hovered/active point marker for the enclosing `<Line>`. */
export const ActiveDot = createMarker<"activeDot", DotProps>("activeDot");

export const XAxis = createMarker<"xAxis", XAxisProps>("xAxis");
export const YAxis = createMarker<"yAxis", YAxisProps>("yAxis");
export const Grid = createMarker<"grid", Record<string, never>>("grid");
export const Tooltip = createMarker<"tooltip", TooltipProps>("tooltip");
export const Legend = createMarker<"legend", LegendProps>("legend");

export { Brush };

export function collectConfig(children: unknown): CollectedConfig {
  const slots = slotsOf(children);

  const bars: BarSeriesConfig[] = filterSlots(slots, "bar").map((slot) => {
    const props = slotProps<BarProps>(slot);
    return {
      dataKey: props.dataKey,
      variant: props.variant ?? "default",
      radius: props.radius ?? DEFAULT_BAR_RADIUS,
      glow: props.glow ?? false,
      animationType: props.animationType,
      isClickable: props.isClickable ?? false,
      enableHoverHighlight: props.enableHoverHighlight ?? false,
      barProps: props.barProps,
    };
  });

  const lines: LineSeriesConfig[] = filterSlots(slots, "line").map((slot) => {
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

    return {
      dataKey: props.dataKey,
      strokeVariant: props.strokeVariant ?? "solid",
      curveType: props.curveType,
      animationType: props.animationType,
      connectNulls: props.connectNulls ?? false,
      glow: props.glow ?? false,
      isClickable: props.isClickable ?? false,
      dotVariant,
      activeDotVariant,
      lineProps: props.lineProps,
    };
  });

  let xAxis: XAxisSlot = { present: false, hideDots: false };
  const xSlot = findSlot(slots, "xAxis");
  if (xSlot) {
    const props = slotProps<XAxisProps>(xSlot);
    xAxis = {
      present: true,
      dataKey: props.dataKey,
      tickFormatter: props.tickFormatter,
      label: props.label,
      hideDots: props.hideDots ?? false,
    };
  }

  let yAxis: YAxisSlot = { present: false, hideDots: false };
  const ySlot = findSlot(slots, "yAxis");
  if (ySlot) {
    const props = slotProps<YAxisProps>(ySlot);
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
    bars,
    lines,
    xAxis,
    yAxis,
    showGrid: findSlot(slots, "grid") !== undefined,
    tooltip,
    legend,
    brush,
  };
}
