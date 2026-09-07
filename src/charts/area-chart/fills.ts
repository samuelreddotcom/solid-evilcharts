/**
 * Area fill paints — the ECharts analogue of the Recharts fill variants.
 *
 * The first three variants are alpha fades; the last three are tiling canvas
 * patterns. Ported from EvilCharts `echarts-area-chart.tsx` (MIT).
 *
 * Everything here needs a real 2D canvas context, so it is a no-op under jsdom
 * (`patternFill` returns null and callers fall back to a flat alpha). The
 * fallbacks are tested; the textures themselves can only be checked in a browser.
 */
import type { ImagePatternObject } from "echarts/core";
import * as echarts from "echarts/core";

import { FALLBACK_SERIES_COLOR, withAlpha } from "../../lib/chart-tokens";
import type { AreaVariant } from "./types";

/**
 * Tiling texture fills, tinted with the series' first colour.
 *
 * Stripes are drawn STRAIGHT (trivially seamless) and the pattern itself is
 * rotated — zrender applies pattern transforms the same way ECharts decals do.
 * Baking a diagonal into a square tile clips the stroke at the corners, which
 * reads as periodic gaps once tiled. Tiles render at devicePixelRatio and scale
 * back down so the texture stays crisp on retina canvases.
 */
export function patternFill(
  kind: "dotted" | "lines" | "hatched" | "stripe",
  color: string,
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

  if (kind === "dotted") {
    size(6, 6);
    // Dots at 0.7 alpha — the vertical fade plus areaStyle opacity temper them,
    // so at a lower alpha they washed out on shorter areas.
    ctx.fillStyle = withAlpha(color, 0.7);
    ctx.beginPath();
    ctx.arc(3, 3, 0.85, 0, Math.PI * 2);
    ctx.fill();
    return pattern();
  }

  if (kind === "lines" || kind === "stripe") {
    // Vertical 1px line every 5px, rotated 45° by the pattern transform.
    size(5, 5);
    ctx.strokeStyle = withAlpha(color, 0.3);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2.5, -1);
    ctx.lineTo(2.5, 6);
    ctx.stroke();
    return pattern(-Math.PI / 4);
  }

  // hatched: bold two-tone stripes leaning ~20°, echoing the Recharts
  // gradient-edged stripe fill.
  size(20, 20);
  ctx.fillStyle = withAlpha(color, 0.06);
  ctx.fillRect(0, 0, 10, 20);
  ctx.fillStyle = withAlpha(color, 0.22);
  ctx.fillRect(10, 0, 10, 20);
  return pattern((20 * Math.PI) / 180);
}

/**
 * Canvas can't express "multi-stop colour horizontally × alpha fade vertically"
 * as one gradient, so multi-colour fills composite the two on an offscreen
 * canvas sized to the chart: paint the horizontal colour run, then mask it with
 * a vertical alpha ramp via destination-in.
 *
 * Regenerated on resize — patterns anchor to the renderer's origin at natural
 * pixel size.
 */
export function gradientFillTexture(
  slots: string[],
  width: number,
  height: number,
  reverse: boolean,
): HTMLCanvasElement | null {
  if (typeof document === "undefined" || width < 1 || height < 1) return null;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const colors = ctx.createLinearGradient(0, 0, canvas.width, 0);
  slots.forEach((color, i) => colors.addColorStop(i / (slots.length - 1), color));
  ctx.fillStyle = colors;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const fade = ctx.createLinearGradient(0, 0, 0, canvas.height);
  fade.addColorStop(0, `rgba(0, 0, 0, ${reverse ? 0 : 0.1})`);
  fade.addColorStop(1, `rgba(0, 0, 0, ${reverse ? 0.1 : 0})`);
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas;
}

/**
 * A pattern fill faded vertically — opaque near the line, transparent toward
 * the baseline — so it reads like the gradient variant instead of a flat wall
 * of pattern.
 *
 * A tiling pattern can't itself carry an alpha ramp, so bake it into a
 * plot-sized texture: tile the pattern (reusing patternFill's tile and
 * rotation), then mask it with a vertical ramp via destination-in.
 */
export function patternFadeTexture(
  kind: "dotted" | "lines" | "hatched",
  color: string,
  width: number,
  height: number,
): HTMLCanvasElement | null {
  const patternObj = patternFill(kind, color);
  if (!patternObj || typeof document === "undefined" || width < 1 || height < 1) {
    return null;
  }
  const tile = patternObj.image;
  if (!(tile instanceof HTMLCanvasElement)) return null;
  const rotation = patternObj.rotation ?? 0;
  // patternFill draws the tile at dpr; 1/dpr scales it back to CSS size.
  const tileScale = patternObj.scaleX ?? 1;

  const w = Math.ceil(width);
  const h = Math.ceil(height);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const pat = ctx.createPattern(tile, "repeat");
  if (!pat) return null;
  // Replicate the ECharts ImagePattern transform so the baked texture matches
  // the plain pattern.
  if (typeof pat.setTransform === "function") {
    const m = new DOMMatrix();
    m.rotateSelf((rotation * 180) / Math.PI);
    m.scaleSelf(tileScale, tileScale);
    pat.setTransform(m);
  }
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);

  const fade = ctx.createLinearGradient(0, 0, 0, h);
  fade.addColorStop(0, "rgba(0, 0, 0, 1)"); // top: keep the pattern
  fade.addColorStop(1, "rgba(0, 0, 0, 0)"); // baseline: fade it out
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, w, h);

  return canvas;
}

/**
 * Resolves an area fill variant into an ECharts colour value.
 *
 * `size` is the full renderer size, used to bake 2D gradients for multi-colour
 * series. `showUnselected` is true for a non-selected area in a chart that has
 * a selection — those recede to a 45° stripe texture.
 */
export function fillPaint(
  variant: AreaVariant,
  showUnselected: boolean,
  slots: string[],
  size: { width: number; height: number },
): string | echarts.graphic.LinearGradient | ImagePatternObject {
  const base = slots[0] ?? FALLBACK_SERIES_COLOR;
  const multi = slots.length > 1;

  // "none" — stroke only, no fill, even when unselected.
  if (variant === "none") return "transparent";

  if (showUnselected) {
    return patternFill("stripe", base) ?? withAlpha(base, 0.1);
  }

  switch (variant) {
    case "gradient":
    case "gradient-reverse": {
      const reverse = variant === "gradient-reverse";
      if (multi) {
        const texture = gradientFillTexture(slots, size.width, size.height, reverse);
        if (texture) return { image: texture, repeat: "no-repeat" };
      }
      return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: withAlpha(base, reverse ? 0 : 0.1) },
        { offset: 1, color: withAlpha(base, reverse ? 0.1 : 0) },
      ]);
    }
    case "solid": {
      // Uniform alpha, so the horizontal colour run survives as one gradient.
      if (multi) {
        return new echarts.graphic.LinearGradient(
          0,
          0,
          1,
          0,
          slots.map((color, i) => ({
            offset: i / (slots.length - 1),
            color: withAlpha(color, 0.1),
          })),
        );
      }
      return withAlpha(base, 0.1);
    }
    case "dotted":
    case "lines":
    case "hatched": {
      // Faded by default: opaque near the line, transparent at the baseline.
      const texture = patternFadeTexture(variant, base, size.width, size.height);
      if (texture) return { image: texture, repeat: "no-repeat" };
      return patternFill(variant, base) ?? withAlpha(base, 0.1);
    }
    default:
      return withAlpha(base, 0.1);
  }
}
