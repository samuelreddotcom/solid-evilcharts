import { createMarker, findSlot, slotProps, slotsOf } from "../../lib/slots";
import {
  DEFAULT_NODE_PADDING,
  type CollectedConfig,
  type LinkProps,
  type LinkSlot,
  type NodeLabelProps,
  type NodeLabelSlot,
  type NodeProps,
  type NodeSlot,
  type TooltipProps,
  type TooltipSlot,
} from "./types";

/**
 * Sankey chart — the declarative config children, and the parser.
 *
 * A sankey's nodes and links are intrinsic to its DATA, so `<Node>` and
 * `<Link>` always take effect — they only CONFIGURE the diagram, unlike the
 * presence-gated parts elsewhere. `<NodeLabel>` and `<Tooltip>` do follow the
 * usual presence semantics.
 */

/** Configures how the sankey nodes render. Compose a `<NodeLabel>` inside it. */
export const Node = createMarker<"node", NodeProps>("node");

/** Declares labels for the `<Node>` it sits inside. No position → no labels. */
export const NodeLabel = createMarker<"nodeLabel", NodeLabelProps>("nodeLabel");

/** Configures how the sankey link bands are coloured. */
export const Link = createMarker<"link", LinkProps>("link");

export const Tooltip = createMarker<"tooltip", TooltipProps>("tooltip");

export function collectConfig(children: unknown): CollectedConfig {
  const slots = slotsOf(children);

  let node: NodeSlot = { radius: 0, isClickable: false };
  let nodeLabel: NodeLabelSlot | null = null;
  const nodeSlot = findSlot(slots, "node");
  if (nodeSlot) {
    const props = slotProps<NodeProps>(nodeSlot);
    node = { radius: props.radius ?? 0, isClickable: props.isClickable ?? false };

    // <NodeLabel> lives inside <Node>, which renders nothing, so Solid never
    // resolved it — reach it here.
    const labelSlot = findSlot(slotsOf(props.children), "nodeLabel");
    if (labelSlot) {
      const labelProps = slotProps<NodeLabelProps>(labelSlot);
      nodeLabel = {
        position: labelProps.position,
        showValues: labelProps.showValues ?? false,
        valueFormatter: labelProps.valueFormatter,
      };
    }
  }

  let link: LinkSlot = { variant: "gradient", verticalPadding: DEFAULT_NODE_PADDING };
  const linkSlot = findSlot(slots, "link");
  if (linkSlot) {
    const props = slotProps<LinkProps>(linkSlot);
    link = {
      variant: props.variant ?? "gradient",
      verticalPadding: props.verticalPadding ?? DEFAULT_NODE_PADDING,
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
      position: props.position ?? "variable",
      defaultIndex: props.defaultIndex,
    };
  }

  return { node, nodeLabel, link, tooltip };
}
