import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as echarts from "echarts/core";

import type { ResolvedColors } from "./chart-tokens";
// Imported for its side effect: echarts.use([CanvasRenderer, SVGRenderer]).
// Without it echarts.init() throws "Renderer 'undefined' is not imported".
// Every chart module imports echarts-paint for seriesPaint anyway, so this
// mirrors real usage rather than working around it.
import "./echarts-paint";
import { isSlot, SLOT } from "./slots";
import {
  BRUSH_BORDER_OPACITY,
  Brush,
  buildBrushDataZoom,
  syncBrushOverlay,
  type BrushOverlayElements,
  type BrushOverlayParams,
} from "./echarts-brush";

const TOKENS: ResolvedColors["tokens"] = {
  mutedForeground: "rgba(100, 100, 100, 1)",
  border: "rgba(200, 200, 200, 0.5)",
  foreground: "rgba(0, 0, 0, 1)",
  background: "rgba(255, 255, 255, 1)",
};

/**
 * Geometry the assertions below are derived from:
 *   top          = 300 - 20 - 56       = 224
 *   centreY      = 224 + 56/2          = 252
 *   trackLeft/Right = 8 / 400-8        = 8 / 392   (width 384)
 *   selectionLeft   = 8 + 384 * 0.25   = 104
 *   selectionRight  = 8 + 384 * 0.75   = 296
 */
const PARAMS: BrushOverlayParams = {
  range: { start: 25, end: 75 },
  geom: { bottom: 20, height: 56 },
  size: { width: 400, height: 300 },
  tokens: TOKENS,
  labels: { start: "Jan", end: "Dec" },
  showLabels: true,
  hover: { left: false, right: false },
};

describe("Brush marker", () => {
  it("is a marker, not a rendering component", () => {
    const result = Brush({ height: 72 }) as unknown;
    expect(isSlot(result)).toBe(true);
    expect((result as Record<symbol, unknown>)[SLOT]).toBe("brush");
  });

  it("carries its props through for the parser", () => {
    const onChange = () => {};
    const result = Brush({ height: 72, onChange }) as unknown as {
      props: { height: number; onChange: () => void };
    };
    expect(result.props.height).toBe(72);
    expect(result.props.onChange).toBe(onChange);
  });
});

describe("buildBrushDataZoom", () => {
  const zoom = buildBrushDataZoom({
    brushBottom: 20,
    brushHeight: 56,
    brushRange: { start: 25, end: 75 },
    fillerColor: "rgba(0, 0, 0, 0)",
  });

  // DataZoomComponentOption is a union of the slider and inside variants, so
  // slider-only fields aren't reachable off the union. Narrow to just what
  // these assertions touch.
  type SliderZoom = {
    type?: string;
    xAxisIndex?: number[];
    start?: number;
    end?: number;
    showDetail?: boolean;
    backgroundColor?: string;
    borderColor?: string;
    handleStyle?: unknown;
    moveHandleSize?: number;
    dataBackground?: unknown;
  };
  const slider = zoom[0] as SliderZoom;
  const inside = zoom[1] as SliderZoom;

  it("returns a slider plus an inside zoom, both on the main x-axis", () => {
    expect(zoom).toHaveLength(2);
    expect(slider.type).toBe("slider");
    expect(inside.type).toBe("inside");
    expect(slider.xAxisIndex).toEqual([0]);
    expect(inside.xAxisIndex).toEqual([0]);
  });

  it("carries the live range so a rebuild doesn't reset the zoom", () => {
    expect(slider.start).toBe(25);
    expect(slider.end).toBe(75);
  });

  it("hides every piece of native chrome — the visuals are graphic overlays", () => {
    expect(slider.showDetail).toBe(false);
    expect(slider.backgroundColor).toBe("transparent");
    expect(slider.borderColor).toBe("transparent");
    expect(slider.handleStyle).toEqual({ opacity: 0 });
    expect(slider.moveHandleSize).toBe(0);
    expect(slider.dataBackground).toEqual({
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
    });
  });
});

describe("syncBrushOverlay", () => {
  let host: HTMLDivElement;
  let chart: ReturnType<typeof echarts.init>;
  let store: { brushOverlay: BrushOverlayElements | null };

  beforeEach(() => {
    host = document.createElement("div");
    Object.defineProperty(host, "clientWidth", { value: 400 });
    Object.defineProperty(host, "clientHeight", { value: 300 });
    document.body.appendChild(host);
    // SVG renderer: jsdom has no canvas, and the overlay needs none.
    chart = echarts.init(host, undefined, { renderer: "svg" });
    store = { brushOverlay: null };
  });

  afterEach(() => {
    chart.dispose();
    host.remove();
  });

  it("creates the full element set on first call", () => {
    syncBrushOverlay(chart, store, PARAMS);

    const els = store.brushOverlay!;
    expect(els).not.toBeNull();
    expect(els.grips).toHaveLength(6); // 3 per handle
    expect(Object.keys(els).sort()).toEqual([
      "dimLeft",
      "dimRight",
      "frame",
      "grips",
      "labelEnd",
      "labelStart",
      "pillLeft",
      "pillRight",
    ]);
  });

  it("reuses the same elements on a second call rather than recreating them", () => {
    syncBrushOverlay(chart, store, PARAMS);
    const first = store.brushOverlay!;

    syncBrushOverlay(chart, store, { ...PARAMS, range: { start: 10, end: 90 } });

    expect(store.brushOverlay).toBe(first);
    expect(store.brushOverlay!.frame).toBe(first.frame);
  });

  it("positions the frame from the range percentages", () => {
    syncBrushOverlay(chart, store, PARAMS);
    const { frame } = store.brushOverlay!;

    expect(frame.shape.x).toBe(104);
    expect(frame.shape.width).toBe(192);
    expect(frame.shape.y).toBe(224);
    expect(frame.shape.height).toBe(56);
    expect(frame.shape.r).toBe(6);
  });

  it("draws the frame as a stroke, never a fill", () => {
    syncBrushOverlay(chart, store, PARAMS);
    const { frame } = store.brushOverlay!;

    expect(frame.style.fill).toBe("none");
    expect(frame.style.lineWidth).toBe(1);
    // withAlpha MULTIPLIES: the border token is already 50% → stays 50% at
    // BRUSH_BORDER_OPACITY of 1.
    expect(BRUSH_BORDER_OPACITY).toBe(1);
    expect(frame.style.stroke).toBe("rgba(200, 200, 200, 0.500)");
  });

  it("dims both sides outside the selection", () => {
    syncBrushOverlay(chart, store, PARAMS);
    const { dimLeft, dimRight } = store.brushOverlay!;

    expect(dimLeft.shape.x).toBe(8);
    expect(dimLeft.shape.width).toBe(96); // 104 - 8
    expect(dimRight.shape.x).toBe(296);
    expect(dimRight.shape.width).toBe(96); // 392 - 296
    expect(dimLeft.style.fill).toBe("rgba(255, 255, 255, 0.700)");
  });

  it("never gives a dim rect a negative width when the range is at an edge", () => {
    syncBrushOverlay(chart, store, {
      ...PARAMS,
      range: { start: 0, end: 100 },
    });
    const { dimLeft, dimRight } = store.brushOverlay!;

    expect(dimLeft.shape.width).toBe(0);
    expect(dimRight.shape.width).toBe(0);
  });

  it("centres the handle pills on the selection edges", () => {
    syncBrushOverlay(chart, store, PARAMS);
    const { pillLeft, pillRight } = store.brushOverlay!;

    expect(pillLeft.shape.x).toBe(101); // 104 - 3
    expect(pillRight.shape.x).toBe(293); // 296 - 3
    expect(pillLeft.shape.y).toBe(244); // centreY 252 - 8
    expect(pillLeft.shape.width).toBe(6);
    expect(pillLeft.shape.height).toBe(16);
  });

  it("brightens only the hovered handle", () => {
    syncBrushOverlay(chart, store, {
      ...PARAMS,
      hover: { left: true, right: false },
    });
    const { pillLeft, pillRight } = store.brushOverlay!;

    expect(pillLeft.style.fill).toBe(TOKENS.foreground);
    expect(pillRight.style.fill).toBe(TOKENS.mutedForeground);
  });

  it("stacks three grip dots per handle around the centre line", () => {
    syncBrushOverlay(chart, store, PARAMS);
    const { grips } = store.brushOverlay!;

    expect(grips.slice(0, 3).map((g) => g.shape.cy)).toEqual([248, 252, 256]);
    expect(grips.slice(0, 3).every((g) => g.shape.cx === 104)).toBe(true);
    expect(grips.slice(3).every((g) => g.shape.cx === 296)).toBe(true);
  });

  it("insets the range labels so they grow inward from each handle", () => {
    syncBrushOverlay(chart, store, PARAMS);
    const { labelStart, labelEnd } = store.brushOverlay!;

    expect(labelStart.style.text).toBe("Jan");
    expect(labelStart.style.x).toBe(110); // 104 + 6
    expect(labelStart.style.align).toBe("left");
    expect(labelEnd.style.text).toBe("Dec");
    expect(labelEnd.style.x).toBe(290); // 296 - 6
    expect(labelEnd.style.align).toBe("right");
  });

  it("clamps labels inside the track at the extremes", () => {
    syncBrushOverlay(chart, store, { ...PARAMS, range: { start: 0, end: 100 } });
    const { labelStart, labelEnd } = store.brushOverlay!;

    expect(labelStart.style.x).toBe(14); // max(8 + 6, 8 + 2)
    expect(labelEnd.style.x).toBe(386); // min(392 - 6, 392 - 2)
  });

  it("hides labels when showLabels is false or the text is empty", () => {
    syncBrushOverlay(chart, store, { ...PARAMS, showLabels: false });
    expect(store.brushOverlay!.labelStart.invisible).toBe(true);

    syncBrushOverlay(chart, store, { ...PARAMS, showLabels: true, labels: null });
    expect(store.brushOverlay!.labelStart.invisible).toBe(true);

    syncBrushOverlay(chart, store, PARAMS);
    expect(store.brushOverlay!.labelStart.invisible).toBe(false);
  });

  it("tears everything down when params is null", () => {
    syncBrushOverlay(chart, store, PARAMS);
    expect(store.brushOverlay).not.toBeNull();

    syncBrushOverlay(chart, store, null);
    expect(store.brushOverlay).toBeNull();
  });

  it("is safe to tear down twice — the onCleanup path", () => {
    syncBrushOverlay(chart, store, PARAMS);
    syncBrushOverlay(chart, store, null);
    expect(() => syncBrushOverlay(chart, store, null)).not.toThrow();
    expect(store.brushOverlay).toBeNull();
  });

  it("rebuilds cleanly after a teardown", () => {
    syncBrushOverlay(chart, store, PARAMS);
    const first = store.brushOverlay!.frame;
    syncBrushOverlay(chart, store, null);
    syncBrushOverlay(chart, store, PARAMS);

    expect(store.brushOverlay).not.toBeNull();
    expect(store.brushOverlay!.frame).not.toBe(first);
  });
});
