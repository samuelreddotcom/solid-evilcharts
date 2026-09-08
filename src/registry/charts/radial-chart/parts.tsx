import { createMarker, findSlot, slotProps, slotsOf } from "../../lib/slots";
import {
  DEFAULT_BAR_SIZE,
  DEFAULT_CORNER_RADIUS,
  type CollectedConfig,
  type LegendProps,
  type LegendSlot,
  type RadialBarProps,
  type RadialBarSlot,
  type TooltipProps,
  type TooltipSlot,
} from "./types";

/**
 * Radial chart — the declarative config children, and the parser.
 *
 * `<RadialBar>` carries the ring geometry; the background pattern is a ROOT
 * PROP here (`backgroundVariant`), not a marker, which is how upstream draws
 * the line between the two polar charts.
 */

/** The radial bar series. Each data row becomes one concentric ring. */
export const RadialBar = createMarker<"radialBar", RadialBarProps>("radialBar");

export const Tooltip = createMarker<"tooltip", TooltipProps>("tooltip");
export const Legend = createMarker<"legend", LegendProps>("legend");

export function collectConfig(children: unknown): CollectedConfig {
  const slots = slotsOf(children);

  // Unlike the pie's `pie: PieSlot | null`, the radial bar slot always exists:
  // without a dataKey there is nothing to plot at all, so an absent <RadialBar>
  // yields an empty key and the chart renders only its track.
  let radialBar: RadialBarSlot = {
    dataKey: "",
    cornerRadius: DEFAULT_CORNER_RADIUS,
    barSize: DEFAULT_BAR_SIZE,
    showBackground: false,
    isClickable: false,
  };
  const barSlot = findSlot(slots, "radialBar");
  if (barSlot) {
    const props = slotProps<RadialBarProps>(barSlot);
    radialBar = {
      dataKey: props.dataKey,
      cornerRadius: props.cornerRadius ?? DEFAULT_CORNER_RADIUS,
      barSize: props.barSize ?? DEFAULT_BAR_SIZE,
      showBackground: props.showBackground ?? false,
      isClickable: props.isClickable ?? false,
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

  return { radialBar, tooltip, legend };
}
