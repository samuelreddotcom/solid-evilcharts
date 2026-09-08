export type CurveType =
  | "linear"
  | "smooth"
  | "bump"
  | "monotone"
  | "monotoneX"
  | "monotoneY"
  | "natural"
  | "step";

/**
 * Series helpers shared by every cartesian chart.
 *
 * EvilCharts duplicates these in each chart file, because each ships as one
 * self-contained copy-paste module. This port already splits charts into
 * directories, so they live here instead — the alternative is the same five
 * functions repeated across eight charts.
 *
 * Engine-agnostic on purpose: nothing here imports `echarts`.
 *
 * This banner sits BELOW the first statement rather than above it because the
 * shadcn CLI deletes all leading trivia when it installs a file. Every other
 * distributed file puts it after the imports; this one has none.
 */

/** Shimmer window half-width, as a fraction of chart width. */
export const LOADING_SHIMMER_BAND = 0.2;
/** Eased edge softening of the shimmer clip window. */
export const LOADING_SHIMMER_FEATHER = 0.2;

/** linear → straight, step → step:"middle", everything else → smooth. */
export function curveConfig(curveType: CurveType): {
  smooth: boolean;
  step: "middle" | false;
} {
  // Recharts "step" is d3's curveStep: the transition happens at the MIDPOINT
  // between points, so each dot sits centred on its plateau.
  if (curveType === "step") return { smooth: false, step: "middle" };
  if (curveType === "linear") return { smooth: false, step: false };
  return { smooth: true, step: false };
}

/**
 * Skeleton data as a smooth random walk in a comfortable band — reads like a
 * resting chart instead of raw noise spikes.
 */
export function getLoadingData(points: number): number[] {
  const rows: number[] = [];
  let value = 30 + Math.random() * 20;
  for (let i = 0; i < points; i++) {
    value = Math.min(58, Math.max(16, value + (Math.random() - 0.5) * 16));
    rows.push(Math.round(value));
  }
  return rows;
}

/**
 * Gradient stops forming a hard clip window around `center`: full `peak` alpha
 * inside, zero outside, with a small feather so the edge isn't aliased.
 * `center` may run outside [0, 1] so the window fully enters and exits frame.
 *
 * `withAlpha` is injected rather than imported so this stays free of any
 * colour-module dependency — callers pass the one from chart-tokens.
 */
export function shimmerWindowStops(
  center: number,
  color: string,
  peak: number,
  withAlpha: (color: string, alpha: number) => string,
) {
  const half = LOADING_SHIMMER_BAND;
  const feather = LOADING_SHIMMER_FEATHER;

  const alphaAt = (x: number) => {
    const dist = Math.abs(x - center);
    if (dist <= half - feather) return peak;
    if (dist >= half) return 0;
    // Sine-eased falloff — a linear ramp still reads as a hard cut.
    return peak * Math.sin(((1 - (dist - (half - feather)) / feather) * Math.PI) / 2);
  };

  const offsets = [
    0,
    center - half,
    center - half + feather,
    center,
    center + half - feather,
    center + half,
    1,
  ]
    .filter((x) => x >= 0 && x <= 1)
    .sort((a, b) => a - b);

  const stops: { offset: number; color: string }[] = [];
  for (const offset of offsets) {
    const last = stops[stops.length - 1];
    if (!last || offset - last.offset > 1e-4) {
      stops.push({ offset, color: withAlpha(color, alphaAt(offset)) });
    }
  }
  return stops;
}

/**
 * Copy a value list with everything AFTER `idx` nulled — the hover-reveal cut.
 * The coloured real series keeps its data up to the cursor and drops the rest,
 * so (with connectNulls false) it stops dead at the pointer.
 */
export function sliceToNull<T>(vals: readonly T[], idx: number): (T | null)[] {
  return vals.map((v, i) => (i > idx ? null : v));
}

/**
 * Copy a value list with everything BEFORE `idx` nulled — the reveal's grey
 * tail. Both slices include `idx`, so they meet exactly at the pointer.
 */
export function sliceFrom<T>(vals: readonly T[], idx: number): (T | null)[] {
  return vals.map((v, i) => (i < idx ? null : v));
}
