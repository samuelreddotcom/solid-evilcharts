import type * as echarts from "echarts/core";

import { FALLBACK_SERIES_COLOR } from "./chart-tokens";

/**
 * Dot markers — maps the resting/active variants onto ECharts symbols.
 * Shared by every chart that draws point markers.
 *
 * Ported from EvilCharts `src/registry/ui/echarts-dot.tsx` (MIT).
 */

export type DotVariant = "none" | "default" | "border" | "colored-border" | "ping";

/**
 * Dot marker paint. Structurally assignable to BOTH the series-level and the
 * per-datum itemStyle — the per-datum variant forbids callback colour paints,
 * so `LineSeriesOption["itemStyle"]` can't be reused for it.
 */
export type DotItemStyleOption = {
  color?: string | echarts.graphic.LinearGradient;
  borderColor?: string | echarts.graphic.LinearGradient;
  borderWidth?: number;
  opacity?: number;
};

export type DotStyle = { size: number; itemStyle: DotItemStyleOption };

/**
 * Re-colours a solid paint AT a given alpha. Accepts hex (#rgb / #rrggbb) or
 * rgb/rgba; named colours pass through untouched.
 *
 * Deliberately NOT `withAlpha` from ./chart-tokens — that one MULTIPLIES the
 * existing alpha (so a 10%-white border token stays subtle), while this one
 * REPLACES it outright and understands hex. Two different jobs that upstream
 * happened to give the same name. The ping halo wants a flat 28% of the series
 * colour regardless of what alpha the paint arrived with.
 */
function atAlpha(color: string, alpha: number): string {
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const n = Number.parseInt(hex, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  const body = color.match(/rgba?\(([^)]+)\)/)?.[1];
  if (body) {
    const [r, g, b] = body.split(",").map((s) => Number.parseFloat(s));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

export function dotItemStyle(
  variant: DotVariant,
  paint: string | echarts.graphic.LinearGradient,
  background: string,
): DotItemStyleOption {
  switch (variant) {
    case "border":
      // Series-coloured core with a thick background halo (Recharts r6 / sw5).
      return { color: paint, borderColor: background, borderWidth: 2 };
    case "colored-border":
      // Background-filled core with a thin coloured ring (Recharts r3 / sw1).
      return { color: background, borderColor: paint, borderWidth: 1 };
    case "ping": {
      // Solid core wrapped in a wide, translucent same-colour ring — a static
      // "ping". The ring is the symbol's BORDER (a stroke ~1.25× the core
      // radius), which fills out to a soft halo disc; a genuinely large symbol
      // would silently fail to render on a category-axis line, so we stroke a
      // small one instead.
      const halo = typeof paint === "string" ? atAlpha(paint, 0.28) : paint;
      return { color: paint, borderColor: halo, borderWidth: 10 };
    }
    case "default":
      return { color: paint, borderWidth: 0 };
    default:
      return {};
  }
}

/**
 * Sizes mirror the Recharts markers: default r3, border r6 (mostly halo),
 * colored-border r3 + ring. Flattening these to one size makes the hover ring
 * read LARGER than a haloed resting dot — the opposite of the Recharts twin.
 */
export const DOT_SIZES: Record<DotVariant, number> = {
  none: 0,
  default: 6,
  border: 8,
  "colored-border": 6,
  ping: 8,
};

export function dotStyle(
  variant: DotVariant,
  paint: string | echarts.graphic.LinearGradient,
  background: string,
): DotStyle {
  return {
    size: DOT_SIZES[variant],
    itemStyle: dotItemStyle(variant, paint, background),
  };
}

/**
 * The colour a horizontal series gradient shows at position t ∈ [0, 1].
 *
 * ECharts paints a gradient itemStyle relative to each symbol's own bounding
 * box — a full rainbow inside every dot — while the Recharts dots clip a
 * chart-wide gradient, so each takes the gradient's colour at its x-position.
 * Sampling reproduces that.
 */
export function sampleGradient(slots: string[], t: number): string {
  if (slots.length <= 1) return slots[0] ?? FALLBACK_SERIES_COLOR;

  const parse = (color: string): number[] => {
    const body = color.match(/rgba?\(([^)]+)\)/)?.[1];
    return body ? body.split(",").map(Number) : [120, 120, 120, 1];
  };

  const position = t * (slots.length - 1);
  const index = Math.min(Math.floor(position), slots.length - 2);
  const fraction = position - index;
  const from = parse(slots[index] ?? "");
  const to = parse(slots[index + 1] ?? "");
  const [r1 = 120, g1 = 120, b1 = 120, a1 = 1] = from;
  const [r2 = 120, g2 = 120, b2 = 120, a2 = 1] = to;
  const lerp = (start: number, end: number) => start + (end - start) * fraction;

  return (
    `rgba(${Math.round(lerp(r1, r2))}, ${Math.round(lerp(g1, g2))}, ` +
    `${Math.round(lerp(b1, b2))}, ${lerp(a1, a2).toFixed(3)})`
  );
}
