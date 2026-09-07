/**
 * Brush — the zoom strip below a cartesian chart.
 *
 * Ported from EvilCharts `src/registry/ui/echarts-brush.tsx` (MIT).
 *
 * This was flagged as the riskiest file to port. It turned out not to be: the
 * only React in it was `const Brush: FC = () => null`, a marker component, now
 * a `createMarker` call. Everything else drives raw zrender elements
 * imperatively and is framework-agnostic already.
 *
 * Why raw zrender rather than `setOption`: the evil-brush look — a rounded
 * frame around the SELECTED range, dimmed sides, grip-dot handle pills, range
 * label pills — is not a dataZoom capability. Routing it through `setOption`
 * re-renders the dataZoom component mid-drag, which resets its drag anchor and
 * makes the handle progressively lag the pointer.
 */
import type { DataZoomComponentOption } from "echarts/components";
import * as echarts from "echarts/core";

import { withAlpha, type ResolvedColors } from "./chart-tokens";
import { createMarker } from "./slots";

type EChartsInstance = ReturnType<typeof echarts.init>;

/** Brush frame opacity, × the border token's own alpha. evil-brush uses the full token. */
export const BRUSH_BORDER_OPACITY = 1;

export interface BrushProps {
  /** Preview strip height in px. Default 56. */
  height?: number;
  /** Formats the range-handle labels. */
  formatLabel?: (value: string, index: number) => string;
  /** Fires as the range moves. */
  onChange?: (range: { startIndex: number; endIndex: number }) => void;
}

/**
 * Declares the zoom brush below the chart. Presence turns it on; renders
 * nothing itself. Shared, so every cartesian chart attaches the same marker.
 */
export const Brush = createMarker<"brush", BrushProps>("brush");

export type BrushRange = { start: number; end: number };
export type BrushGeometry = { bottom: number; height: number };

export type BrushOverlayParams = {
  range: BrushRange;
  geom: BrushGeometry;
  size: { width: number; height: number };
  tokens: ResolvedColors["tokens"];
  labels: { start: string; end: string } | null;
  showLabels: boolean;
  hover: { left: boolean; right: boolean };
};

type ZrRect = InstanceType<typeof echarts.graphic.Rect>;
type ZrCircle = InstanceType<typeof echarts.graphic.Circle>;
type ZrText = InstanceType<typeof echarts.graphic.Text>;

export type BrushOverlayElements = {
  dimLeft: ZrRect;
  dimRight: ZrRect;
  frame: ZrRect;
  pillLeft: ZrRect;
  pillRight: ZrRect;
  /** 3 left + 3 right. */
  grips: ZrCircle[];
  labelStart: ZrText;
  labelEnd: ZrText;
};

/**
 * Creates, updates, or tears down the brush overlay elements.
 *
 * Passing `params: null` removes everything and clears the store — that is the
 * teardown path, and it is what a Solid `onCleanup` should call.
 */
export function syncBrushOverlay(
  chart: EChartsInstance,
  store: { brushOverlay: BrushOverlayElements | null },
  params: BrushOverlayParams | null,
) {
  const zr = chart.getZr();
  if (!zr) return;

  if (!params) {
    if (store.brushOverlay) {
      const { grips, ...rest } = store.brushOverlay;
      [...Object.values(rest), ...grips].forEach((el) => zr.remove(el));
      store.brushOverlay = null;
    }
    return;
  }

  if (!store.brushOverlay) {
    const rect = (z: number) =>
      new echarts.graphic.Rect({ silent: true, z, shape: {} });
    const els: BrushOverlayElements = {
      dimLeft: rect(100),
      dimRight: rect(100),
      frame: rect(101),
      pillLeft: rect(102),
      pillRight: rect(102),
      grips: Array.from(
        { length: 6 },
        () => new echarts.graphic.Circle({ silent: true, z: 103, shape: {} }),
      ),
      labelStart: new echarts.graphic.Text({ silent: true, z: 104 }),
      labelEnd: new echarts.graphic.Text({ silent: true, z: 104 }),
    };
    const { grips, ...rest } = els;
    [...Object.values(rest), ...grips].forEach((el) => zr.add(el));
    store.brushOverlay = els;
  }

  const els = store.brushOverlay;
  const { range, geom, size, tokens, labels, showLabels, hover } = params;

  const trackLeft = 8;
  const trackRight = Math.max(size.width - 8, trackLeft);
  const trackWidth = trackRight - trackLeft;
  const top = size.height - geom.bottom - geom.height;
  const centerY = top + geom.height / 2;
  const selectionLeft = trackLeft + (trackWidth * range.start) / 100;
  const selectionRight = trackLeft + (trackWidth * range.end) / 100;

  const dimFill = withAlpha(tokens.background, 0.7);
  els.dimLeft.setShape({
    x: trackLeft,
    y: top,
    width: Math.max(selectionLeft - trackLeft, 0),
    height: geom.height,
  });
  els.dimLeft.setStyle({ fill: dimFill });
  els.dimRight.setShape({
    x: selectionRight,
    y: top,
    width: Math.max(trackRight - selectionRight, 0),
    height: geom.height,
  });
  els.dimRight.setStyle({ fill: dimFill });

  els.frame.setShape({
    x: selectionLeft,
    y: top,
    width: Math.max(selectionRight - selectionLeft, 0),
    height: geom.height,
    r: 6,
  });
  els.frame.setStyle({
    fill: "none",
    stroke: withAlpha(tokens.border, BRUSH_BORDER_OPACITY),
    lineWidth: 1,
  });

  // Handle pills: evil-brush's 6×16 grip pill, centred on the selection edge,
  // brightening to foreground on hover/drag.
  const pill = (el: ZrRect, x: number, hovered: boolean) => {
    el.setShape({ x: x - 3, y: centerY - 8, width: 6, height: 16, r: 3 });
    el.setStyle({ fill: hovered ? tokens.foreground : tokens.mutedForeground });
  };
  pill(els.pillLeft, selectionLeft, hover.left);
  pill(els.pillRight, selectionRight, hover.right);

  const gripFill = withAlpha(tokens.background, 0.7);
  [-4, 0, 4].forEach((offset, i) => {
    const left = els.grips[i];
    const right = els.grips[i + 3];
    if (!left || !right) return;
    left.setShape({ cx: selectionLeft, cy: centerY + offset, r: 1 });
    left.setStyle({ fill: gripFill });
    right.setShape({ cx: selectionRight, cy: centerY + offset, r: 1 });
    right.setStyle({ fill: gripFill });
  });

  // Range label pills straddle the frame's bottom line — an overlay, so they
  // occupy no layout space; half the pill sits above the line, half below. Each
  // grows INWARD from its handle with a small inset, like the Recharts labels,
  // instead of hanging past the frame edge.
  const label = (el: ZrText, text: string, x: number, align: "left" | "right") => {
    el.setStyle({
      text,
      x:
        align === "left"
          ? Math.max(x + 6, trackLeft + 2)
          : Math.min(x - 6, trackRight - 2),
      y: top + geom.height,
      align,
      verticalAlign: "middle",
      fill: tokens.background,
      backgroundColor: tokens.foreground,
      padding: [2, 5],
      borderRadius: 4,
      font: "500 9px system-ui, sans-serif",
    });
    el.attr("invisible", !showLabels || !text);
  };
  label(els.labelStart, labels?.start ?? "", selectionLeft, "left");
  label(els.labelEnd, labels?.end ?? "", selectionRight, "right");
}

/**
 * The dataZoom slider — a transparent drag layer over the mini chart.
 *
 * Interaction only: the visible frame, handles and labels are the graphic
 * overlays above. Both zoom entries target the MAIN x-axis (index 0) so the
 * mini chart never filters itself. The per-chart mini-series are built by each
 * chart, not here.
 */
export function buildBrushDataZoom(params: {
  brushBottom: number;
  brushHeight: number;
  brushRange: BrushRange;
  fillerColor: string;
}): DataZoomComponentOption[] {
  const { brushBottom, brushHeight, brushRange, fillerColor } = params;

  return [
    {
      type: "slider",
      show: true,
      xAxisIndex: [0],
      left: 8,
      right: 8,
      bottom: brushBottom,
      height: brushHeight,
      // Carry the live range through every rebuild — a notMerge push without
      // start/end would reset the zoom to the full extent.
      start: brushRange.start,
      end: brushRange.end,
      brushSelect: false,
      // Range labels are overlay pills below the frame (see syncBrushOverlay);
      // the native detail text renders INSIDE the track, which is not the
      // evil-brush look.
      showDetail: false,
      backgroundColor: "transparent",
      // The visible frame is the graphic overlay riding the selection — the
      // component's own static border stays hidden.
      borderColor: "transparent",
      fillerColor,
      dataBackground: { lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 } },
      selectedDataBackground: {
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
      },
      // Interaction only — kept generous for an easy grab target.
      handleIcon: "path://M -3 -5 L -3 5 A 3 3 0 0 0 3 5 L 3 -5 A 3 3 0 0 0 -3 -5 Z",
      handleSize: "35%",
      handleStyle: { opacity: 0 },
      moveHandleSize: 0,
      emphasis: { handleStyle: { opacity: 0 } },
    },
    { type: "inside", xAxisIndex: [0] },
  ];
}
