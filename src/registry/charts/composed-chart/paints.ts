/**
 * Composed chart — bar fill paints.
 *
 * A smaller set than the pure bar chart's: no `blocks` or `expandable`, because
 * both need post-layout measurement. Everything here is pure except
 * `barHatchPattern`, which needs a real 2D context and is a no-op under jsdom.
 *
 * Ported from EvilCharts `echarts-composed-chart.tsx` (MIT).
 */
import type { ImagePatternObject } from "echarts/core";
import * as echarts from "echarts/core";

import { FALLBACK_SERIES_COLOR, withAlpha } from "../../lib/chart-tokens";
import type { BarVariant, SeriesPaint } from "./types";

/**
 * The Recharts hatch mask, exactly: a field at 30% alpha with a full-strength
 * 1.5px stripe every 5px, leaning -45°.
 *
 * Drawn STRAIGHT and rotated by the pattern transform — baking the diagonal into
 * the tile clips the stripe at the corners, which reads as periodic gaps.
 */
export function barHatchPattern(color: string): ImagePatternObject | null {
  if (typeof document === "undefined") return null;
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const period = 5;
  const stripe = 1.5;
  canvas.width = period * dpr;
  canvas.height = period * dpr;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = withAlpha(color, 0.3);
  ctx.fillRect(0, 0, period, period);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, stripe, period);

  return {
    image: canvas,
    repeat: "repeat",
    rotation: -Math.PI / 4,
    scaleX: 1 / dpr,
    scaleY: 1 / dpr,
  };
}

/** A series' colours as a vertical top→bottom run, or a plain string for one. */
export function verticalColorGradient(
  slots: string[],
): string | echarts.graphic.LinearGradient {
  if (slots.length <= 1) return slots[0] ?? FALLBACK_SERIES_COLOR;
  return new echarts.graphic.LinearGradient(
    0,
    0,
    0,
    1,
    slots.map((color, i) => ({ offset: i / (slots.length - 1), color })),
  );
}

export function barFillPaint(variant: BarVariant, slots: string[]): SeriesPaint {
  const base = slots[0] ?? FALLBACK_SERIES_COLOR;
  const multi = slots.length > 1;

  switch (variant) {
    case "gradient": {
      // Bar colour faded toward the baseline — full near the top (≤20%), gone by
      // 90%. Recharts' GradientPattern mask, expressed as vertical alpha.
      const fade = (t: number) => (t <= 0.2 ? 1 : t >= 0.9 ? 0 : 1 - (t - 0.2) / 0.7);
      if (multi) {
        return new echarts.graphic.LinearGradient(
          0,
          0,
          0,
          1,
          slots.map((color, i) => {
            const t = i / (slots.length - 1);
            return { offset: t, color: withAlpha(color, fade(t)) };
          }),
        );
      }
      return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: withAlpha(base, 1) },
        { offset: 0.2, color: withAlpha(base, 1) },
        { offset: 0.9, color: withAlpha(base, 0) },
        { offset: 1, color: withAlpha(base, 0) },
      ]);
    }
    case "duotone":
    case "duotone-reverse": {
      // Horizontal two-tone split: one half full strength, the other at 40%.
      const reverse = variant === "duotone-reverse";
      const dim = withAlpha(base, 0.4);
      const left = reverse ? base : dim;
      const right = reverse ? dim : base;
      return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
        { offset: 0, color: left },
        { offset: 0.5, color: left },
        { offset: 0.5, color: right },
        { offset: 1, color: right },
      ]);
    }
    case "stripped": {
      // A faint wash (0.4 → 0.1 down the bar) under a bright top edge. The strip
      // lives INSIDE the gradient (a full-alpha stop in the top ~5%), since
      // ECharts bars can't carry a separate top-only fill.
      //
      // Note this is the SIMPLE stripped: a fixed 5% fraction, so the cap scales
      // with bar height. The pure bar chart's version derives a per-datum
      // fraction from measured pixels to keep it constant — deliberately not
      // brought over, since it would drag the whole measure/re-push cycle in.
      return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: withAlpha(base, 1) },
        { offset: 0.05, color: withAlpha(base, 0.4) },
        { offset: 1, color: withAlpha(base, 0.1) },
      ]);
    }
    case "hatched":
      return barHatchPattern(base) ?? base;
    case "default":
    default:
      return verticalColorGradient(slots);
  }
}
