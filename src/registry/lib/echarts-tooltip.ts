import type { TooltipComponentOption } from "echarts/components";

import { indicatorBackground, type ResolvedColors } from "./chart-tokens";

/**
 * Tooltip — shared HTML shell/row builders plus the chart-agnostic option
 * fields. Each chart composes its own rows but shares the shell and base option.
 *
 * The tooltip DOM lives inside `[data-chart={id}]`, so the injected
 * `--color-*` vars and Tailwind classes resolve directly — no colour read
 * needed at build time.
 *
 * Ported from EvilCharts `src/registry/ui/echarts-tooltip.tsx` (MIT). Note
 * these are string builders, not components: ECharts' tooltip `formatter`
 * returns an HTML string, so there is nothing to convert to Solid JSX.
 */

export type TooltipVariant = "default" | "frosted-glass";
export type TooltipRoundness = "sm" | "md" | "lg" | "xl";

/**
 * Anchoring. "variable" follows both axes (ECharts' default); "fixed" tracks
 * the pointer's X but stays pinned near the top.
 */
export type TooltipPosition = "fixed" | "variable";

export const roundnessClass: Record<TooltipRoundness, string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
};

export const tooltipVariantClass: Record<TooltipVariant, string> = {
  default: "bg-background",
  "frosted-glass": "bg-background/50 backdrop-blur-md",
};

/**
 * The standard series indicator swatch — a rounded square filled with the
 * series' solid var or multi-stop gradient. A chart drops this into a
 * tooltipRow's `indicatorHtml`.
 */
export function tooltipIndicatorHtml(key: string, colorsCount: number): string {
  return `<div class="h-2.5 w-2.5 shrink-0 rounded-[2px]" style="background:${indicatorBackground(key, colorsCount)}"></div>`;
}

/**
 * One tooltip row: indicator swatch + label/value pair.
 *
 * `dimmed` is a class fragment (e.g. `" opacity-30"`) appended to the row, so
 * the selection/hover dim stays byte-identical to the inlined markup upstream.
 */
export function tooltipRow({
  indicatorHtml,
  labelText,
  valueText,
  dimmed,
}: {
  indicatorHtml: string;
  labelText: string;
  valueText: string;
  dimmed: string;
}): string {
  return `<div class="flex w-full flex-wrap items-center gap-2${dimmed}">
          ${indicatorHtml}
          <div class="flex flex-1 items-center justify-between gap-4 leading-none">
            <span class="text-muted-foreground">${labelText}</span>
            <span class="text-foreground font-mono font-medium tabular-nums">${valueText}</span>
          </div>
        </div>`;
}

/**
 * The outer tooltip surface — border, padding, shadow, roundness and variant
 * classes — wrapping the axis label and the composed rows.
 */
export function tooltipShell({
  label,
  body,
  roundness,
  variant,
}: {
  label: string;
  body: string;
  roundness: TooltipRoundness;
  variant: TooltipVariant;
}): string {
  return `<div class="grid min-w-32 items-start gap-1.5 border border-border/50 px-2.5 py-1.5 text-xs shadow-xl ${roundnessClass[roundness]} ${tooltipVariantClass[variant]}">
      <div class="font-medium text-primary">${label}</div>
      <div class="grid gap-1.5">${body}</div>
    </div>`;
}

/**
 * Maps TooltipPosition onto the ECharts tooltip `position` field.
 * "variable" → undefined (follow both axes); "fixed" → a callback centring on
 * the pointer's X and pinning Y near the top.
 */
export function resolveTooltipPosition(
  position: TooltipPosition,
): TooltipComponentOption["position"] {
  if (position === "variable") return undefined;
  return (point, _params, _dom, _rect, size) => [
    point[0] - size.contentSize[0] / 2,
    8,
  ];
}

/**
 * The chart-agnostic tooltip option fields. The chart supplies only `formatter`
 * and spreads this in.
 *
 * `axisPointerColor` arrives pre-resolved, so this helper needs no live token
 * read and stays a pure function.
 */
export function tooltipBaseOption(params: {
  present: boolean;
  cursor: boolean;
  tokens: ResolvedColors["tokens"];
  position: TooltipPosition;
  axisPointerColor: string;
  strokeWidth: number;
}): TooltipComponentOption {
  const { present, cursor, position, axisPointerColor, strokeWidth } = params;

  return {
    show: present,
    trigger: "axis",
    confine: true,
    displayTransition: false,
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0,
    extraCssText: "box-shadow:none;",
    axisPointer: cursor
      ? {
          type: "line",
          lineStyle: {
            color: axisPointerColor,
            width: strokeWidth,
            type: [3, 3] as [number, number],
          },
        }
      : { type: "none" },
    position: resolveTooltipPosition(position),
  };
}
