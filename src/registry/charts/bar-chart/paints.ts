/**
 * Bar fill paints — the ECharts analogue of the Recharts bar fill variants.
 *
 * Unlike the area chart's fills (which run the colour gradient HORIZONTALLY), a
 * bar's base colour gradient runs VERTICALLY top→bottom, matching Recharts'
 * `ColorGradient` (x1 = x2 = 0), so each bar shows the full multi-stop gradient
 * inside its own box.
 *
 * Ported from EvilCharts `echarts-bar-chart.tsx` (MIT).
 *
 * The pattern fills need a real 2D canvas context, so they are no-ops under
 * jsdom and every caller falls back to a solid paint. The gradient paints are
 * pure and fully testable.
 */
import type { ImagePatternObject } from "echarts/core";
import * as echarts from "echarts/core";

import { FALLBACK_SERIES_COLOR, withAlpha } from "../../lib/chart-tokens";
import { sampleGradient } from "../../lib/echarts-dot";
import {
  BLOCK_GAP,
  BLOCK_SIZE,
  EXPAND_COLLAPSED,
  STRIPPED_BODY_ALPHA,
  STRIPPED_CAP_HEIGHT,
  STRIPPED_CAP_MAX_FRACTION,
  STRIPPED_FALLBACK_FRACTION,
  type BarVariant,
} from "./types";

/**
 * Solid vertical top→bottom colour for a series — a plain string when there is
 * one colour, else a vertical multi-stop gradient in each bar's own box. The
 * `default` variant paints from this at full alpha.
 */
export function solidVerticalPaint(
  slots: string[],
  alpha: number,
): string | echarts.graphic.LinearGradient {
  if (slots.length <= 1) {
    const base = slots[0] ?? FALLBACK_SERIES_COLOR;
    return alpha === 1 ? base : withAlpha(base, alpha);
  }
  const stops = slots.map((color, i) => ({
    offset: i / (slots.length - 1),
    color: withAlpha(color, alpha),
  }));
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, stops);
}

/**
 * The `gradient` variant: the vertical colour gradient faded from solid at the
 * top to clear at the bottom. Recharts masks with white@1 at 20% → white@0 at
 * 90%, so the alpha holds full through the top fifth and vanishes by 90%.
 */
export function verticalFadePaint(slots: string[]): echarts.graphic.LinearGradient {
  const offsets = [0, 0.2, 0.45, 0.7, 0.9, 1];
  const alphaAt = (t: number) => (t <= 0.2 ? 1 : t >= 0.9 ? 0 : 1 - (t - 0.2) / 0.7);
  const stops = offsets.map((t) => ({
    offset: t,
    color: withAlpha(sampleGradient(slots, t), alphaAt(t)),
  }));
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, stops);
}

/**
 * The `duotone` family: a hard alpha split across the bar's short axis (its
 * width for vertical bars, its height for horizontal).
 *
 * Recharts splits at 50% via an objectBoundingBox mask — exact for
 * single-colour series. Multi-colour duotone falls back to the base colour, an
 * accepted approximation matching the twin's single-colour examples.
 */
export function duotoneSplitPaint(
  base: string,
  leftAlpha: number,
  rightAlpha: number,
  isHorizontal: boolean,
): echarts.graphic.LinearGradient {
  const stops = [
    { offset: 0, color: withAlpha(base, leftAlpha) },
    { offset: 0.5, color: withAlpha(base, leftAlpha) },
    { offset: 0.5, color: withAlpha(base, rightAlpha) },
    { offset: 1, color: withAlpha(base, rightAlpha) },
  ];
  // Split across the CROSS axis: vertical (0→1 in y) for horizontal bars,
  // horizontal (1→0 in x) for vertical ones, so it always reads across the bar.
  return isHorizontal
    ? new echarts.graphic.LinearGradient(0, 0, 0, 1, stops)
    : new echarts.graphic.LinearGradient(1, 0, 0, 0, stops);
}

/**
 * The `stripped` variant: a small BRIGHT cap on a dimmed body — the canvas twin
 * of Recharts' fixed strip.
 *
 * The cap is baked into a per-datum gradient whose bright band spans exactly
 * `capFraction` of the bar (offset 0 = the tip). Because `capFraction` comes
 * from `strippedCapFraction` as CAP_HEIGHT / barPixelHeight, the cap reads the
 * SAME pixel height on every bar — the fraction shrinks as the bar grows. The
 * coincident offsets keep the cap a crisp pill rather than a fade.
 */
export function strippedDatumPaint(
  slots: string[],
  isHorizontal: boolean,
  capFraction: number,
): echarts.graphic.LinearGradient {
  const f = Math.min(Math.max(capFraction, 0), 1);
  const cap = withAlpha(sampleGradient(slots, 0), 1);
  const bodyTop = withAlpha(sampleGradient(slots, f), STRIPPED_BODY_ALPHA);
  const bodyEnd = withAlpha(sampleGradient(slots, 1), STRIPPED_BODY_ALPHA);
  const stops = [
    { offset: 0, color: cap },
    { offset: f, color: cap },
    { offset: f, color: bodyTop },
    { offset: 1, color: bodyEnd },
  ];
  // Tip at offset 0: top (y 0→1) for vertical bars, right (x 1→0) for horizontal.
  return isHorizontal
    ? new echarts.graphic.LinearGradient(1, 0, 0, 0, stops)
    : new echarts.graphic.LinearGradient(0, 0, 0, 1, stops);
}

/**
 * The gradient fraction that renders a STRIPPED_CAP_HEIGHT-pixel cap on a bar of
 * the given value-axis magnitude. Falls back to a small constant before the
 * coordinate system has been measured (the very first paint, corrected right
 * after layout).
 */
export function strippedCapFraction(
  value: number,
  valuePxPerUnit: number | null,
): number {
  if (valuePxPerUnit == null) return STRIPPED_FALLBACK_FRACTION;
  const barPx = Math.abs(value) * valuePxPerUnit;
  if (!(barPx > 0)) return STRIPPED_FALLBACK_FRACTION;
  return Math.min(STRIPPED_CAP_HEIGHT / barPx, STRIPPED_CAP_MAX_FRACTION);
}

/**
 * Tiling texture fills tinted with the series' first colour.
 *
 * Stripes are drawn STRAIGHT (trivially seamless) and the pattern itself is
 * rotated — baking a diagonal into a square tile clips the stroke at the
 * corners, which reads as periodic gaps once tiled. Tiles render at
 * devicePixelRatio and scale back down so the texture stays crisp on retina.
 */
export function patternFill(
  kind: "hatched" | "buffer" | "blocks",
  color: string,
  blockSize = BLOCK_SIZE,
): ImagePatternObject | null {
  if (typeof document === "undefined") return null;
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const size = (width: number, height: number) => {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
  };
  const pattern = (rotation = 0): ImagePatternObject => ({
    image: canvas,
    repeat: "repeat",
    rotation,
    scaleX: 1 / dpr,
    scaleY: 1 / dpr,
  });

  if (kind === "blocks") {
    // 1px-wide tile: it repeats horizontally into a full-width band, and
    // vertically into the stack of blocks.
    size(1, blockSize + BLOCK_GAP);
    ctx.fillStyle = withAlpha(color, 1);
    ctx.fillRect(0, 0, 1, blockSize);
    return pattern();
  }

  if (kind === "hatched") {
    // Recharts hatched: the colour at 0.3 everywhere, punched to full along a
    // 1.5px stripe every 5px, leaning -45°.
    size(5, 5);
    ctx.fillStyle = withAlpha(color, 0.3);
    ctx.fillRect(0, 0, 5, 5);
    ctx.fillStyle = withAlpha(color, 1);
    ctx.fillRect(0, 0, 1.5, 5);
    return pattern(-Math.PI / 4);
  }

  // buffer: bare diagonal lines on a transparent ground (no body fill), for the
  // last "projected" bar.
  size(5, 5);
  ctx.fillStyle = withAlpha(color, 1);
  ctx.fillRect(0, 0, 1, 5);
  return pattern(-Math.PI / 4);
}

/**
 * The `expandable` fill at a given openness: a horizontal gradient with HARD
 * stops, transparent outside the centre strip and the series paint inside it.
 *
 * Animating `fraction` slides those stops outward from the middle, which is the
 * expand; a real width change would relayout the bar group instead.
 */
export function expandableDatumPaint(
  slots: string[],
  fraction: number,
): echarts.graphic.LinearGradient {
  const base = slots[0] ?? FALLBACK_SERIES_COLOR;
  const half = Math.max(0, Math.min(1, fraction)) / 2;
  const left = 0.5 - half;
  const right = 0.5 + half;
  const clear = withAlpha(base, 0);
  return new echarts.graphic.LinearGradient(0, 0, 1, 0, [
    { offset: 0, color: clear },
    { offset: left, color: clear },
    { offset: left, color: base },
    { offset: right, color: base },
    { offset: right, color: clear },
    { offset: 1, color: clear },
  ]);
}

/** Resolves a bar variant into an ECharts fill for its series. */
export function barFillPaint(
  variant: BarVariant,
  slots: string[],
  isHorizontal: boolean,
  blockSize = BLOCK_SIZE,
): string | echarts.graphic.LinearGradient | ImagePatternObject {
  const base = slots[0] ?? FALLBACK_SERIES_COLOR;
  switch (variant) {
    case "gradient":
      return verticalFadePaint(slots);
    case "duotone":
      return duotoneSplitPaint(base, 0.4, 1, isHorizontal);
    case "duotone-reverse":
      return duotoneSplitPaint(base, 1, 0.4, isHorizontal);
    case "hatched":
      return patternFill("hatched", base) ?? solidVerticalPaint(slots, 1);
    case "blocks":
      return patternFill("blocks", base, blockSize) ?? solidVerticalPaint(slots, 1);
    case "expandable":
      // Series-level fallback only; buildBarSeries gives every datum its own
      // openness so a single hovered bar can expand on its own.
      return expandableDatumPaint(slots, EXPAND_COLLAPSED);
    case "stripped":
      // Series-level fallback only; buildBarSeries overrides every stripped
      // datum with its own fixed-pixel cap fraction.
      return strippedDatumPaint(slots, isHorizontal, STRIPPED_FALLBACK_FRACTION);
    default:
      return solidVerticalPaint(slots, 1);
  }
}

/**
 * Border radius per variant and layout. Non-stripped bars round every corner;
 * stripped rounds only the tip corners — the top for vertical bars, the right
 * end for horizontal.
 */
export function barBorderRadius(
  radius: number,
  variant: BarVariant,
  isHorizontal: boolean,
): number | number[] {
  // Blocks draw their own square segments; a radius would clip the end one. An
  // expandable bar is a thin line at rest, where a radius would swallow it.
  if (variant === "blocks" || variant === "expandable") return 0;
  if (variant !== "stripped") return radius;
  // ECharts corner order: [top-left, top-right, bottom-right, bottom-left].
  return isHorizontal ? [0, radius, radius, 0] : [radius, radius, 0, 0];
}
