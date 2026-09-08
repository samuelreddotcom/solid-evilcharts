/**
 * Legend overlay — replicates EvilCharts' ChartLegendContent and its 7
 * indicator variants. The legend is HTML inside `[data-chart={id}]`, so it uses
 * the injected `--color-*` vars directly.
 *
 * Ported from EvilCharts `src/registry/ui/echarts-legend.tsx` (MIT).
 *
 * ─── Porting hazard, read before editing ───────────────────────────────────
 * Solid's `style` prop applies an object through `element.style.setProperty()`,
 * which takes CSS property names verbatim — so every key here MUST be
 * kebab-case. React's camelCase (`backgroundColor`, `WebkitMaskComposite`)
 * silently does nothing in Solid: no error, no warning, the style just never
 * lands. Guarded by echarts-legend.test.tsx.
 */
import { For, type JSX } from "solid-js";

import { getColorsCount, indicatorBackground, type ChartConfig } from "./chart-tokens";

export type LegendVariant =
  | "square"
  | "circle"
  | "circle-outline"
  | "rounded-square"
  | "rounded-square-outline"
  | "vertical-bar"
  | "horizontal-bar";

export function legendFillStyle(key: string, colorsCount: number): JSX.CSSProperties {
  if (colorsCount <= 1) return { "background-color": `var(--color-${key}-0)` };
  return { background: indicatorBackground(key, colorsCount) };
}

/**
 * Punches out the centre with a mask-composite so only the "border" shows.
 * Works with gradients and border-radius, unlike plain border-color.
 */
export function legendOutlineStyle(key: string, colorsCount: number): JSX.CSSProperties {
  const mask: JSX.CSSProperties = {
    "-webkit-mask": "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
    "-webkit-mask-composite": "xor",
    mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
    "mask-composite": "exclude",
  };
  return { ...legendFillStyle(key, colorsCount), ...mask };
}

export function LegendIndicator(props: {
  variant: LegendVariant;
  dataKey: string;
  colorsCount: number;
}): JSX.Element {
  const fill = () => legendFillStyle(props.dataKey, props.colorsCount);
  const outline = () => legendOutlineStyle(props.dataKey, props.colorsCount);

  switch (props.variant) {
    case "square":
      return <div class="h-2 w-2 shrink-0" style={fill()} />;
    case "circle":
      return <div class="h-2 w-2 shrink-0 rounded-full" style={fill()} />;
    case "circle-outline":
      return (
        <div class="h-2.5 w-2.5 shrink-0 rounded-full p-[1.5px]" style={outline()} />
      );
    case "vertical-bar":
      return <div class="h-3 w-1 shrink-0 rounded-[2px]" style={fill()} />;
    case "horizontal-bar":
      return <div class="h-1 w-3 shrink-0 rounded-[2px]" style={fill()} />;
    case "rounded-square-outline":
      return (
        <div class="h-2.5 w-2.5 shrink-0 rounded-[3px] p-[1.5px]" style={outline()} />
      );
    case "rounded-square":
    default:
      return <div class="h-2 w-2 shrink-0 rounded-[2px]" style={fill()} />;
  }
}

export type LegendOverlayProps = {
  seriesKeys: string[];
  config: ChartConfig;
  variant: LegendVariant;
  align: "left" | "center" | "right";
  /**
   * Carried for parity with the chart's LegendSlot. Positioning arrives fully
   * via `style` — the chart owns the brush/verticalAlign layout maths.
   */
  verticalAlign: "top" | "middle" | "bottom";
  selectedKey: string | null;
  hoveredKey: string | null;
  isClickable: boolean;
  onToggle: (key: string) => void;
  style: JSX.CSSProperties;
};

/**
 * The positioned HTML legend row. The chart computes the absolute-positioned
 * `style` and passes it in; this renders the entries, their indicators, and the
 * selection/hover dim.
 */
export function LegendOverlay(props: LegendOverlayProps): JSX.Element {
  const justify = () =>
    props.align === "left"
      ? "justify-start"
      : props.align === "center"
        ? "justify-center"
        : "justify-end";

  const isSelected = (key: string) =>
    (props.selectedKey === null || props.selectedKey === key) &&
    (props.hoveredKey === null || props.hoveredKey === key);

  return (
    <div style={props.style} class={`flex items-center gap-4 select-none ${justify()}`}>
      <For each={props.seriesKeys}>
        {(key) => {
          const item = () => props.config[key];
          const colorsCount = () => {
            const entry = item();
            return entry ? getColorsCount(entry) : 1;
          };
          return (
            // No entrance animation here — the Recharts legend appears
            // instantly, and a fade-in reads as disconnected from the canvas
            // draw-in.
            <div
              class={`flex items-center gap-1.5 transition-opacity ${
                !isSelected(key) ? "opacity-30" : ""
              } ${props.isClickable ? "cursor-pointer" : ""}`}
              onClick={() => {
                if (props.isClickable) props.onToggle(key);
              }}
            >
              <LegendIndicator
                variant={props.variant}
                dataKey={key}
                colorsCount={colorsCount()}
              />
              {item()?.label}
            </div>
          );
        }}
      </For>
    </div>
  );
}
