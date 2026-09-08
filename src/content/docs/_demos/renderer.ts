/**
 * Which ECharts renderer the docs demos use.
 *
 * Canvas everywhere real — it is the library's own default, and a docs page
 * should show what a reader actually gets when they install the chart.
 *
 * Under Vitest it has to be SVG. jsdom has no 2D context (vitest.setup.ts
 * deliberately returns null from getContext), so ECharts' canvas painter dies
 * on `layer.ctx.dpr` the moment setOption runs. Every chart test in this repo
 * drives the SVG renderer for exactly that reason — see line-chart.test.tsx.
 *
 * Keeping the switch here rather than in each demo means the docs render test
 * covers the real component, not a test-only variant of it.
 *
 * This file sits outside src/registry/, so it is never distributed — the
 * boundary test enforces that.
 */
import { DEFAULT_ECHARTS_RENDERER } from "~/registry/lib/echarts-paint";
import type { EChartsRenderer } from "~/registry/lib/echarts-paint";

export const DOCS_RENDERER: EChartsRenderer = import.meta.env.VITEST
  ? "svg"
  : DEFAULT_ECHARTS_RENDERER;
