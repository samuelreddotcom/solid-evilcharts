import { createMarker, findSlot, slotProps, slotsOf } from "../../lib/slots";
import {
  DEFAULT_CORNER_RADIUS,
  DEFAULT_END_ANGLE,
  DEFAULT_INNER_RADIUS,
  DEFAULT_OUTER_RADIUS,
  DEFAULT_PADDING_ANGLE,
  DEFAULT_START_ANGLE,
  type BackgroundProps,
  type BackgroundSlot,
  type CollectedConfig,
  type LabelPosition,
  type LabelProps,
  type LegendProps,
  type LegendSlot,
  type PieProps,
  type PieSlot,
  type TooltipProps,
  type TooltipSlot,
} from "./types";

/**
 * Pie chart — the declarative config children, and the parser.
 *
 * `<Pie>` carries the whole shape (radii, angles, rounding, padding); `<Label>`
 * is nested inside it. No axes, grid or brush here.
 */

/**
 * The pie series. Declares its own shape and clickability; compose a `<Label>`
 * inside it to draw per-sector labels.
 */
export const Pie = createMarker<"pie", PieProps>("pie");

/** Declares per-sector labels for the enclosing `<Pie>`. */
export const Label = createMarker<"label", LabelProps>("label");

export const Tooltip = createMarker<"tooltip", TooltipProps>("tooltip");
export const Legend = createMarker<"legend", LegendProps>("legend");

/** Presence draws a decorative SVG pattern behind the pie. */
export const Background = createMarker<"background", BackgroundProps>("background");

export function collectConfig(children: unknown): CollectedConfig {
  const slots = slotsOf(children);

  let pie: PieSlot | null = null;
  const pieSlot = findSlot(slots, "pie");
  if (pieSlot) {
    const props = slotProps<PieProps>(pieSlot);

    // `<Label>` lives inside `<Pie>`, and Pie never renders, so Solid never
    // resolved it — reach it here.
    let labelDataKey: string | null = null;
    let labelPosition: LabelPosition = "inside";
    const labelSlot = findSlot(slotsOf(props.children), "label");
    if (labelSlot) {
      const labelProps = slotProps<LabelProps>(labelSlot);
      // "" means "present, but use the position-appropriate default key".
      labelDataKey = labelProps.dataKey ?? "";
      labelPosition = labelProps.position ?? "inside";
    }

    pie = {
      variant: props.variant ?? "gradient",
      innerRadius: props.innerRadius ?? DEFAULT_INNER_RADIUS,
      outerRadius: props.outerRadius ?? DEFAULT_OUTER_RADIUS,
      cornerRadius: props.cornerRadius ?? DEFAULT_CORNER_RADIUS,
      paddingAngle: props.paddingAngle ?? DEFAULT_PADDING_ANGLE,
      startAngle: props.startAngle ?? DEFAULT_START_ANGLE,
      endAngle: props.endAngle ?? DEFAULT_END_ANGLE,
      isClickable: props.isClickable ?? false,
      labelDataKey,
      labelPosition,
    };
  }

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

  // Note the legend defaults differ from the cartesian charts': a pie's legend
  // sits centred along the bottom, not right-aligned at the top.
  let legend: LegendSlot = {
    present: false,
    variant: "rounded-square",
    align: "center",
    verticalAlign: "bottom",
    isClickable: false,
  };
  const legendSlot = findSlot(slots, "legend");
  if (legendSlot) {
    const props = slotProps<LegendProps>(legendSlot);
    legend = {
      present: true,
      variant: props.variant ?? "rounded-square",
      align: props.align ?? "center",
      verticalAlign: props.verticalAlign ?? "bottom",
      isClickable: props.isClickable ?? false,
    };
  }

  let background: BackgroundSlot = { present: false, variant: "dots" };
  const backgroundSlot = findSlot(slots, "background");
  if (backgroundSlot) {
    const props = slotProps<BackgroundProps>(backgroundSlot);
    background = { present: true, variant: props.variant ?? "dots" };
  }

  return { pie, tooltip, legend, background };
}
