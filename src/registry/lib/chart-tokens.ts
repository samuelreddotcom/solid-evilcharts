/**
 * Engine-neutral chart colour plumbing.
 *
 * Ported from EvilCharts `src/registry/ui/echarts-chart.tsx` (MIT), split out
 * so nothing here imports `echarts` or any framework. That is the whole point
 * of the file: when a second rendering engine lands (TanStack Charts), it
 * consumes this module unchanged and becomes a second *implementation* rather
 * than a second project.
 *
 * The one Solid-specific concession is `JSX.Element` / `Component` in
 * ChartConfig, replacing React's ReactNode / ComponentType. Those are types
 * only — they vanish at runtime.
 *
 * ECharts-specific paint (LinearGradient construction) lives in
 * ./echarts-paint.ts.
 */
import type { Component, JSX } from "solid-js";

// ─────────────────────────────────────────────────────────────────────────────
// Theme keys + config
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Theme selectors. Light is the bare root, dark is `.dark`.
 *
 * Load-bearing: buildChartCss() emits `.dark [data-chart=id] { … }`, so this
 * must match the `@custom-variant dark (&:is(.dark *))` in styles.css.
 * Guarded by styles/tokens.test.ts.
 */
export const THEMES = { light: "", dark: ".dark" } as const;

export type ThemeKey = keyof typeof THEMES;

export const THEME_KEYS = Object.keys(THEMES) as ThemeKey[];

/** At least one theme must supply colours; the other may be omitted. */
export type AtLeastOneThemeColor =
  | { light: string[]; dark?: string[] }
  | { light?: string[]; dark: string[] };

export type ChartConfig = Record<
  string,
  {
    label?: JSX.Element;
    icon?: Component;
    colors?: AtLeastOneThemeColor;
  }
>;

// ─────────────────────────────────────────────────────────────────────────────
// Colour slot maths
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Slots a key needs = the longest colour array across themes, minimum 1.
 * Both themes always emit the same number of `--color-{key}-{n}` vars, so a
 * series defined with 3 light colours and 1 dark colour still lines up.
 */
export function getColorsCount(item: ChartConfig[string]): number {
  if (!item.colors) return 1;
  const counts = THEME_KEYS.map((theme) => item.colors?.[theme]?.length ?? 0);
  return Math.max(...counts, 1);
}

/**
 * Distributes colours evenly across slots; extra slots go to the LAST colours.
 *
 *   2 colours / 4 slots → [c0, c0, c1, c1]
 *   3 colours / 4 slots → [c0, c1, c2, c2]
 */
export function distributeColors(colors: string[], maxCount: number): string[] {
  const available = colors.length;
  if (available >= maxCount) return colors.slice(0, maxCount);

  const result: string[] = [];
  const baseSlots = Math.floor(maxCount / available);
  const extraSlots = maxCount % available;

  for (let i = 0; i < available; i++) {
    const isExtra = i >= available - extraSlots;
    const slots = baseSlots + (isExtra ? 1 : 0);
    for (let j = 0; j < slots; j++) result.push(colors[i]!);
  }

  return result;
}

/**
 * Emits `--color-{key}-{n}` scoped to `[data-chart={id}]` for light and
 * `.dark [data-chart={id}]` for dark — the CSS EvilCharts' <ChartStyle> writes.
 */
export function buildChartCss(id: string, config: ChartConfig): string {
  const colorConfig = Object.entries(config).filter(([, item]) => item.colors);
  if (!colorConfig.length) return "";

  const varsFor = (theme: ThemeKey) =>
    colorConfig
      .flatMap(([key, item]) => {
        const authored = item.colors?.[theme];
        if (!authored || authored.length === 0) return [];
        return distributeColors(authored, getColorsCount(item)).map(
          (color, index) => `  --color-${key}-${index}: ${color};`,
        );
      })
      .join("\n");

  return Object.entries(THEMES)
    .map(
      ([theme, prefix]) =>
        `${prefix} [data-chart=${id}] {\n${varsFor(theme as ThemeKey)}\n}`,
    )
    .join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Colour normalisation
// ─────────────────────────────────────────────────────────────────────────────

let normalizerCtx: CanvasRenderingContext2D | null = null;

/**
 * Normalises ANY CSS colour (hex, named, oklch, colour-mix…) to a concrete
 * `rgba(r, g, b, a)` string by painting it on a 1×1 canvas and reading the
 * pixel back. A single reused canvas serves every call.
 *
 * This is why the token layer can be authored in oklch while the chart code
 * downstream only ever deals in rgba: ECharts cannot interpolate oklch, and
 * withAlpha/flattenColor below both parse rgba by regex.
 *
 * Degrades to returning the input untouched when there is no DOM or no 2D
 * context — which is exactly what happens under jsdom, since jsdom ships no
 * canvas implementation. Tests assert the fallback, not the normalisation.
 */
export function normalizeColor(value: string): string {
  const raw = value.trim();
  if (!raw || typeof document === "undefined") return raw;

  if (!normalizerCtx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    normalizerCtx = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!normalizerCtx) return raw;

  normalizerCtx.clearRect(0, 0, 1, 1);
  normalizerCtx.fillStyle = "#000";
  normalizerCtx.fillStyle = raw; // an invalid value leaves the sentinel in place
  normalizerCtx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = normalizerCtx.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${((a ?? 255) / 255).toFixed(3)})`;
}

/** Parses the numeric channels out of an `rgb()` / `rgba()` string. */
function parseRgb(value: string): [number, number, number, number] {
  const body = value.match(/rgba?\(([^)]+)\)/)?.[1];
  if (!body) return [0, 0, 0, 1];
  const parts = body.split(",").map((part) => Number.parseFloat(part.trim()));
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
}

/**
 * Scales the alpha of a normalised rgba string.
 *
 * MULTIPLIES rather than replaces, which keeps translucent theme tokens honest:
 * a border token that is already 10%-white lands at 5% under
 * `withAlpha(border, 0.5)`, matching Tailwind's `border/50`. Replacing would
 * make it 50% and blow out the grid lines in dark mode, where `--border` is
 * `oklch(100% 0 271.152 / 0.075)`.
 */
export function withAlpha(color: string, alpha: number): string {
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (!match?.[1]) return color;
  const [r, g, b, a] = match[1].split(",").map((part) => part.trim());
  const base = a === undefined ? 1 : Number.parseFloat(a) || 0;
  return `rgba(${r}, ${g}, ${b}, ${(base * alpha).toFixed(3)})`;
}

/**
 * Composites a translucent colour over an opaque base into a FLAT colour.
 *
 * The tick dots need this: a translucent stroke double-paints where its round
 * caps overlap the line body, which reads as two stacked colours.
 */
export function flattenColor(color: string, base: string): string {
  const [r, g, b, a] = parseRgb(color);
  const [baseR, baseG, baseB] = parseRgb(base);
  const mix = (channel: number, baseChannel: number) =>
    Math.round(channel * a + baseChannel * (1 - a));
  return `rgb(${mix(r, baseR)}, ${mix(g, baseG)}, ${mix(b, baseB)})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading resolved colours off the live DOM
// ─────────────────────────────────────────────────────────────────────────────

export type ResolvedColors = {
  /** Normalised `--color-{key}-{n}` slots, per series key. */
  series: Record<string, string[]>;
  tokens: {
    mutedForeground: string;
    border: string;
    foreground: string;
    background: string;
  };
};

/** Used when a `--color-{key}-{n}` var is missing entirely. */
export const FALLBACK_SERIES_COLOR = "rgba(120, 120, 120, 1)";

/**
 * The four Tailwind classes the token probe reads. Kept exported so
 * styles/tokens.test.ts asserts against the same list this code uses, rather
 * than a copy that can drift.
 */
export const PROBE_CLASSES = {
  mutedForeground: "text-muted-foreground",
  border: "text-border",
  foreground: "text-foreground",
  background: "text-background",
} as const;

/**
 * Reads the injected CSS vars and theme tokens off the live DOM.
 *
 * Series slots come from getComputedStyle on the container. Theme tokens come
 * from a throwaway probe span carrying the matching Tailwind class — reading
 * the *class* rather than the var name keeps this robust to however a consuming
 * theme happens to name its variables.
 *
 * Must run after the chart's <style> has been injected and after the element is
 * in the document, or every slot falls back to grey.
 */
export function resolveColors(
  container: HTMLElement,
  config: ChartConfig,
  seriesKeys: string[],
): ResolvedColors {
  const computed = getComputedStyle(container);
  const series: Record<string, string[]> = {};

  for (const key of seriesKeys) {
    const count = getColorsCount(config[key] ?? {});
    const slots: string[] = [];
    for (let n = 0; n < count; n++) {
      const raw = computed.getPropertyValue(`--color-${key}-${n}`).trim();
      slots.push(raw ? normalizeColor(raw) : FALLBACK_SERIES_COLOR);
    }
    series[key] = slots;
  }

  const probe = document.createElement("span");
  probe.style.cssText =
    "position:absolute;width:0;height:0;visibility:hidden;pointer-events:none;";
  container.appendChild(probe);
  const readToken = (className: string) => {
    probe.className = className;
    return normalizeColor(getComputedStyle(probe).color);
  };
  const tokens = {
    mutedForeground: readToken(PROBE_CLASSES.mutedForeground),
    border: readToken(PROBE_CLASSES.border),
    foreground: readToken(PROBE_CLASSES.foreground),
    background: readToken(PROBE_CLASSES.background),
  };
  container.removeChild(probe);

  return { series, tokens };
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicator paint (CSS, not engine)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A series indicator's background: a solid var, or a left→right gradient of
 * vars when the series has multiple colours.
 *
 * Deliberately lives here rather than in echarts-paint.ts — it returns a plain
 * CSS string consumed by the tooltip rows and legend swatches, both of which
 * are DOM, not canvas. No engine involvement.
 */
export function indicatorBackground(key: string, colorsCount: number): string {
  if (colorsCount <= 1) return `var(--color-${key}-0)`;
  const stops = Array.from({ length: colorsCount }, (_, i) => {
    const offset = (i / (colorsCount - 1)) * 100;
    return `var(--color-${key}-${i}) ${offset}%`;
  }).join(", ");
  return `linear-gradient(to right, ${stops})`;
}
