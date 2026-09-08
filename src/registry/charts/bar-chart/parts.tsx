import { Brush, type BrushProps } from "../../lib/echarts-brush";
import { createMarker, filterSlots, findSlot, slotProps, slotsOf } from "../../lib/slots";
import type {
  AxisSlot,
  BarProps,
  BarSeriesConfig,
  BrushSlot,
  CollectedConfig,
  LegendProps,
  LegendSlot,
  TooltipProps,
  TooltipSlot,
  XAxisProps,
  YAxisProps,
} from "./types";

/**
 * Bar chart — the declarative config children, and the parser that walks them.
 *
 * Unlike line/area, `<Bar>` takes no nested children: dots are meaningless on a
 * rectangle. `<XAxis>` and `<YAxis>` swap category/value roles with `layout`, so
 * both collect into the same `AxisSlot` shape and the option builder decides
 * which is which.
 */

/**
 * A single bar series. Declares its own fill variant, radius, glow, buffer, and
 * clickability.
 */
export const Bar = createMarker<"bar", BarProps>("bar");

/** Category axis in the default (vertical) layout, value axis when horizontal. */
export const XAxis = createMarker<"xAxis", XAxisProps>("xAxis");

/** Value axis in the default (vertical) layout, category axis when horizontal. */
export const YAxis = createMarker<"yAxis", YAxisProps>("yAxis");

/** Presence shows the dashed split lines on the value axis. */
export const Grid = createMarker<"grid", Record<string, never>>("grid");

/** Presence enables the hover tooltip. */
export const Tooltip = createMarker<"tooltip", TooltipProps>("tooltip");

/** Presence enables the HTML legend overlay. */
export const Legend = createMarker<"legend", LegendProps>("legend");

export { Brush };

function axisSlot(props: XAxisProps | YAxisProps): AxisSlot {
  return {
    present: true,
    dataKey: props.dataKey,
    tickFormatter: props.tickFormatter,
    label: props.label,
    hideDots: props.hideDots ?? false,
  };
}

export function collectConfig(children: unknown): CollectedConfig {
  const slots = slotsOf(children);

  const bars: BarSeriesConfig[] = filterSlots(slots, "bar").map((slot) => {
    const props = slotProps<BarProps>(slot);
    return {
      dataKey: props.dataKey,
      variant: props.variant ?? "default",
      radius: props.radius,
      animationType: props.animationType,
      isClickable: props.isClickable ?? false,
      enableHoverHighlight: props.enableHoverHighlight ?? false,
      glowing: props.glowing ?? false,
      bufferBar: props.bufferBar ?? false,
    };
  });

  const xSlot = findSlot(slots, "xAxis");
  const xAxis: AxisSlot = xSlot
    ? axisSlot(slotProps<XAxisProps>(xSlot))
    : { present: false, hideDots: false };

  const ySlot = findSlot(slots, "yAxis");
  const yAxis: AxisSlot = ySlot
    ? axisSlot(slotProps<YAxisProps>(ySlot))
    : { present: false, hideDots: false };

  let tooltip: TooltipSlot = {
    present: false,
    variant: "default",
    roundness: "lg",
    position: "variable",
  };
  const tooltipSlot = findSlot(slots, "tooltip");
  if (tooltipSlot) {
    const props = slotProps<TooltipProps>(tooltipSlot);
    tooltip = {
      present: true,
      variant: props.variant ?? "default",
      roundness: props.roundness ?? "lg",
      defaultIndex: props.defaultIndex,
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
    xAxis,
    yAxis,
    showGrid: findSlot(slots, "grid") !== undefined,
    tooltip,
    legend,
    brush,
  };
}
