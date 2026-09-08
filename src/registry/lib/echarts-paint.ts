import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import * as echarts from "echarts/core";

import { FALLBACK_SERIES_COLOR } from "./chart-tokens";

/**
 * The ECharts-specific half of the colour layer.
 *
 * Everything here touches `echarts`. Everything that doesn't lives in
 * ./chart-tokens.ts, which a second rendering engine can consume untouched.
 *
 * Ported from EvilCharts `src/registry/ui/echarts-chart.tsx` (MIT).
 */

export const ECHARTS_RENDERERS = {
  canvas: "canvas",
  svg: "svg",
} as const;

export type EChartsRenderer =
  (typeof ECHARTS_RENDERERS)[keyof typeof ECHARTS_RENDERERS];

export const DEFAULT_ECHARTS_RENDERER = ECHARTS_RENDERERS.canvas;

/**
 * Renderer registration, shared by every chart module.
 *
 * Individual charts register only the series and components they use
 * (`echarts.use([LineChart, GridComponent, …])`), which is what keeps the
 * bundle from pulling in all of ECharts. Renderers are the one thing worth
 * registering centrally, since both are small and every chart can switch
 * between them at runtime via the `renderer` prop.
 */
echarts.use([CanvasRenderer, SVGRenderer]);

/**
 * A series' paint: a solid colour string when there is one colour, otherwise an
 * evenly distributed left→right LinearGradient.
 *
 * Reused for the stroke, the symbol fills, and as the base tint for area fills.
 * Returns an ECharts graphic object, which is why this can't live in
 * chart-tokens.ts.
 */
export function seriesPaint(
  slots: string[],
): string | echarts.graphic.LinearGradient {
  if (slots.length <= 1) return slots[0] ?? FALLBACK_SERIES_COLOR;
  const stops = slots.map((color, i) => ({
    offset: i / (slots.length - 1),
    color,
  }));
  return new echarts.graphic.LinearGradient(0, 0, 1, 0, stops);
}
