import type { DotVariant } from "../../lib/echarts-dot";
import { createMarker, filterSlots, findSlot, slotProps, slotsOf } from "../../lib/slots";
import {
  DEFAULT_FILL_OPACITY,
  type CollectedConfig,
  type DotProps,
  type LegendProps,
  type LegendSlot,
  type PolarAngleAxisProps,
  type PolarAngleAxisSlot,
  type PolarGridProps,
  type PolarGridSlot,
  type PolarRadiusAxisSlot,
  type RadarProps,
  type RadarSeriesConfig,
  type TooltipProps,
  type TooltipSlot,
} from "./types";

/**
 * Radar chart — the declarative config children, and the parser.
 *
 * The three axis-ish markers map onto ECharts fields whose names don't match
 * their own: `<PolarGrid>` drives the spokes AND the rings, `<PolarAngleAxis>`
 * the perimeter labels, `<PolarRadiusAxis>` the radial scale.
 */

/** A single radar series — one polygon over all angle-axis categories. */
export const Radar = createMarker<"radar", RadarProps>("radar");

/** Declares the resting vertex marker for the enclosing `<Radar>`. */
export const Dot = createMarker<"dot", DotProps>("dot");

/** Declares the hovered/active vertex marker for the enclosing `<Radar>`. */
export const ActiveDot = createMarker<"activeDot", DotProps>("activeDot");

/** Presence draws the polar grid — concentric rings AND radial spokes. */
export const PolarGrid = createMarker<"polarGrid", PolarGridProps>("polarGrid");

/** Presence shows the category labels around the perimeter. */
export const PolarAngleAxis = createMarker<"polarAngleAxis", PolarAngleAxisProps>(
  "polarAngleAxis",
);

/** Presence shows the radial value scale running from the centre outward. */
export const PolarRadiusAxis = createMarker<"polarRadiusAxis", Record<string, never>>(
  "polarRadiusAxis",
);

export const Tooltip = createMarker<"tooltip", TooltipProps>("tooltip");
export const Legend = createMarker<"legend", LegendProps>("legend");

export function collectConfig(children: unknown): CollectedConfig {
  const slots = slotsOf(children);

  const radars: RadarSeriesConfig[] = filterSlots(slots, "radar").map((slot) => {
    const props = slotProps<RadarProps>(slot);
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
      variant: props.variant ?? "filled",
      fillOpacity: props.fillOpacity ?? DEFAULT_FILL_OPACITY,
      isClickable: props.isClickable ?? false,
      dotVariant,
      activeDotVariant,
    };
  });

  let grid: PolarGridSlot = { present: false, gridType: "polygon" };
  const gridSlot = findSlot(slots, "polarGrid");
  if (gridSlot) {
    const props = slotProps<PolarGridProps>(gridSlot);
    grid = { present: true, gridType: props.gridType ?? "polygon" };
  }

  let angleAxis: PolarAngleAxisSlot = { present: false };
  const angleSlot = findSlot(slots, "polarAngleAxis");
  if (angleSlot) {
    const props = slotProps<PolarAngleAxisProps>(angleSlot);
    angleAxis = { present: true, dataKey: props.dataKey };
  }

  const radiusAxis: PolarRadiusAxisSlot = {
    present: findSlot(slots, "polarRadiusAxis") !== undefined,
  };

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
      position: props.position ?? "variable",
      defaultIndex: props.defaultIndex,
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

  return { radars, grid, angleAxis, radiusAxis, tooltip, legend };
}
