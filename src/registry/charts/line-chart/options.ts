/**
 * Line chart — pure option builders.
 *
 * Every function here maps a snapshot context to an ECharts option fragment.
 * Nothing touches reactive state or the chart instance: the component reads its
 * refs and renderer size ONCE per build into an OptionBuildContext, so each
 * fragment can be reasoned about (and tested) in isolation.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-line-chart.tsx` (MIT).
 */
import { LineChart, type LineSeriesOption } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
  type DataZoomComponentOption,
  type GridComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import type { ComposeOption } from "echarts/core";
import * as echarts from "echarts/core";

import {
  FALLBACK_SERIES_COLOR,
  flattenColor,
  getColorsCount,
  withAlpha,
  type ChartConfig,
  type ResolvedColors,
} from "../../lib/chart-tokens";
import {
  curveConfig,
  getLoadingData,
  shimmerWindowStops as sharedShimmerWindowStops,
  sliceFrom,
  sliceToNull,
} from "../../lib/chart-series";
import { buildBrushDataZoom, type BrushRange } from "../../lib/echarts-brush";
import {
  dotItemStyle,
  dotStyle,
  sampleGradient,
  type DotItemStyleOption,
} from "../../lib/echarts-dot";
import { seriesPaint } from "../../lib/echarts-paint";
import {
  tooltipBaseOption,
  tooltipIndicatorHtml,
  tooltipRow,
  tooltipShell,
} from "../../lib/echarts-tooltip";
import {
  AXIS_POINTER_OPACITY,
  BRUSH_FILLER_OPACITY,
  BRUSH_STROKE_OPACITY,
  BUFFER_DASH,
  BUFFER_PREFIX,
  GLOW_LAYERS,
  GRID_LINE_OPACITY,
  REVEAL_PREFIX,
  STROKE_WIDTH,
  type CurveType,
  type LegendSlot,
  type LineSeriesConfig,
  type TooltipSlot,
  type XAxisSlot,
  type YAxisSlot,
} from "./types";

/**
 * Modular registration keeps the bundle lean — only the pieces this chart
 * needs. `DataZoomComponent` bundles both the slider (brush footer) and inside
 * (wheel/drag) zoom. The brush's frame/handles/labels are raw zrender elements,
 * not the graphic component, so no GraphicComponent is registered.
 */
echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent]);

/**
 * The exact option surface this chart uses. Narrower than ECharts' full
 * EChartsOption, so a misspelled key fails the compile instead of silently
 * reaching setOption.
 */
export type EChartsOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | DataZoomComponentOption
>;

// Single-entry views of the composed option's array-or-single fields — the
// modular entry points don't export the axis option types directly.
type ArrayItem<T> = T extends readonly (infer U)[] ? U : T;
export type XAxisOption = ArrayItem<NonNullable<EChartsOption["xAxis"]>>;
export type YAxisOption = ArrayItem<NonNullable<EChartsOption["yAxis"]>>;

export type OptionBuildContext = {
  data: Record<string, unknown>[];
  config: ChartConfig;
  lines: LineSeriesConfig[];
  curveType: CurveType;
  selectedDataKey: string | null;
  hasSelection: boolean;
  showGrid: boolean;
  xAxisSlot: XAxisSlot;
  yAxisSlot: YAxisSlot;
  tooltipSlot: TooltipSlot;
  legendSlot: LegendSlot;
  isLoading: boolean;
  loadingData: () => number[];
  showBrush: boolean;
  brushHeight: number;
  enableHoverHighlight: boolean;
  enableHoverReveal: boolean;
  /** Pointer's x-index while revealing; null = idle, chart looks normal. */
  revealIndex: number | null;
  /** buildLineSeries writes each line's full per-datum points here. */
  revealSink: Record<string, unknown[]>;
  resolved: ResolvedColors;
  /** Anchored reveal stroke gradients span the plot in absolute pixels. */
  rendererSize: { width: number; height: number };
  categories: string[];
  /** Zoom window carried through rebuilds. */
  brushRange: BrushRange;
  /** Read per tooltip render — hover never repushes the option. */
  getHoveredKey: () => string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Small pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dims a series only when another one is selected. Lines have no fill, so only
 * the stroke and dots carry an opacity.
 */
export function getOpacity(selected: string | null, key: string) {
  if (selected === null || selected === key) return { stroke: 1, dot: 1 };
  return { stroke: 0.3, dot: 0.3 };
}

// curveConfig, getLoadingData, shimmerWindowStops, sliceToNull and sliceFrom are
// shared with every other cartesian chart — see ../../lib/chart-series.ts.
// Re-exported so this module stays the single import site for a chart's builders.
export { curveConfig, getLoadingData, sliceFrom, sliceToNull };

/** shimmerWindowStops with this repo's withAlpha bound in. */
export function shimmerWindowStops(center: number, color: string, peak: number) {
  return sharedShimmerWindowStops(center, color, peak, withAlpha);
}

/**
 * The plotted values for a line, optionally decorated per-datum. Multi-colour
 * lines tint each symbol with the gradient's colour at its own x-position (like
 * the Recharts dots); single-colour lines return raw numbers. `null` entries
 * pass through untouched — they carve the gap a buffer line's two parts leave.
 */
export type LinePoint =
  | number
  | null
  | {
      value: number | null;
      itemStyle: DotItemStyleOption;
      emphasis: { itemStyle: DotItemStyleOption };
    };

// ─────────────────────────────────────────────────────────────────────────────
// Glow overlay
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the stacked glow overlay series for one `<Line glowing>`.
 *
 * Each copy is silent, tooltip-less, and z-ordered beneath the real line.
 * `selectionDim` fades the whole glow with its parent when another series is
 * selected; the emphasis/blur styles let it focus/dim WITH its parent under
 * enableHoverHighlight (the component dispatch-links these ids).
 */
export function buildGlowSeries(params: {
  key: string;
  paint: string | echarts.graphic.LinearGradient;
  slots: string[];
  values: (number | null)[];
  curve: { smooth: boolean; step: "middle" | false };
  connectNulls: boolean;
  z: number;
  selectionDim: number;
  dotSize: number;
}): LineSeriesOption[] {
  const { key, paint, slots, values, curve, connectNulls, z, selectionDim, dotSize } =
    params;
  const multiColor = slots.length > 1;
  const base = slots[0] ?? FALLBACK_SERIES_COLOR;
  const showDots = dotSize > 0;

  return GLOW_LAYERS.map((layer, i): LineSeriesOption => {
    const glowOpacity = layer.opacity * selectionDim;
    const blurOpacity = glowOpacity * 0.3;
    // Per-datum halo colours so a gradient glow tints each dot at its own
    // x-position, matching sampleGradient on the real dots.
    const glowData: LinePoint[] =
      !multiColor || !showDots
        ? values
        : values.map((value, idx): LinePoint => {
            if (value === null) return null;
            const t = values.length > 1 ? idx / (values.length - 1) : 0;
            const color = sampleGradient(slots, t);
            return {
              value,
              itemStyle: { color, opacity: glowOpacity },
              emphasis: { itemStyle: { color, opacity: glowOpacity } },
            };
          });

    return {
      id: `__glow-${i}-${key}`,
      type: "line",
      data: glowData,
      smooth: curve.smooth,
      step: curve.step,
      connectNulls,
      silent: true,
      showSymbol: showDots,
      symbol: "circle",
      symbolSize: showDots ? dotSize + layer.symbolPad : 0,
      tooltip: { show: false },
      z,
      lineStyle: {
        color: paint,
        width: layer.width,
        opacity: glowOpacity,
        // Feathers this layer's edge so the stack reads as one smooth falloff
        // rather than concentric bands (see GLOW_LAYERS).
        shadowBlur: layer.blur,
        // Full-alpha shadow colour: the element's own `opacity` above already
        // scales its shadow, so pre-dimming here squares the alpha and washes
        // the halo out.
        shadowColor: sampleGradient(slots, 0.5),
        cap: "round",
        join: "round",
      },
      itemStyle: multiColor
        ? { opacity: glowOpacity }
        : { color: base, opacity: glowOpacity },
      emphasis: {
        focus: "none",
        scale: false,
        lineStyle: { opacity: glowOpacity },
        itemStyle: { opacity: glowOpacity },
      },
      blur: {
        lineStyle: { opacity: blurOpacity },
        itemStyle: { opacity: blurOpacity },
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout + axes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Grid insets plus the footer band reserved for the brush. ECharts 6 contains
 * axis labels automatically (the legacy `containLabel` flag now only triggers a
 * deprecation warning).
 */
export function buildChartLayout(ctx: OptionBuildContext): {
  grid: GridComponentOption;
  brushBottom: number;
} {
  const { legendSlot, xAxisSlot, showBrush, brushHeight } = ctx;
  const legendTop = legendSlot.present && legendSlot.verticalAlign === "top";
  const legendBottom = legendSlot.present && legendSlot.verticalAlign === "bottom";
  // Clearance covers the x-axis labels plus the same breathing room the Recharts
  // twin leaves between them and the brush. An x-axis TITLE renders below the
  // labels (nameGap), so it needs its own band above the brush frame.
  const brushGap = showBrush ? brushHeight + 30 + (xAxisSlot.label ? 22 : 0) : 0;

  return {
    grid: {
      left: 8,
      right: 8,
      top: legendTop ? 42 : 16,
      bottom: 8 + brushGap + (legendBottom ? 34 : 0),
    },
    brushBottom: legendBottom ? 34 : 6,
  };
}

export function buildMainAxes(ctx: OptionBuildContext): {
  xAxis: XAxisOption;
  yAxis: YAxisOption;
} {
  const { xAxisSlot, yAxisSlot, showGrid, isLoading, categories, loadingData } = ctx;
  const { tokens } = ctx.resolved;

  const axisLabelColor = tokens.mutedForeground;
  const splitLineColor = withAlpha(tokens.border, GRID_LINE_OPACITY);
  // Gridline grey as an opaque colour — see flattenColor.
  const tickDotColor = flattenColor(splitLineColor, tokens.background);

  const xTickFormatter = xAxisSlot.tickFormatter;
  const yTickFormatter = yAxisSlot.tickFormatter;

  const xAxis: XAxisOption = {
    type: "category",
    boundaryGap: false,
    show: true,
    data: isLoading ? loadingData().map((_, i) => i) : categories,
    name: isLoading ? undefined : xAxisSlot.label,
    nameLocation: "middle",
    nameGap: 30,
    nameTextStyle: { color: axisLabelColor, fontSize: 10 },
    axisLine: { show: false },
    // Tick DOTS: a near-zero-length tick whose round caps form a true circle,
    // in the gridline grey (flattened opaque so the caps don't stack).
    axisTick: {
      show: !isLoading && xAxisSlot.present && !xAxisSlot.hideDots,
      // Category ticks default to the BOUNDARY between categories, which on a
      // boundaryGap axis drops the dot in the gap instead of under its label. A
      // no-op here (boundaryGap is false) — set for parity with the bar chart.
      alignWithLabel: true,
      length: 0.5,
      lineStyle: { color: tickDotColor, width: 3, cap: "round" },
    },
    splitLine: { show: false },
    axisLabel: {
      show: !isLoading && xAxisSlot.present,
      color: axisLabelColor,
      fontSize: 10,
      margin: 8,
      formatter: xTickFormatter
        ? (value: string, index: number) => xTickFormatter(value, index)
        : undefined,
    },
  };

  // An ECharts axis with `show: false` hides its splitLines too, but Recharts'
  // <CartesianGrid> draws with or without a visible <YAxis>. Keep the axis on
  // whenever <Grid/> is present and gate the LABELS on <YAxis/> instead.
  const yAxis: YAxisOption = {
    type: "value",
    show: yAxisSlot.present || showGrid,
    name: isLoading ? undefined : yAxisSlot.label,
    nameLocation: "middle",
    nameGap: 38,
    nameTextStyle: { color: axisLabelColor, fontSize: 10 },
    axisLine: { show: false },
    // No alignWithLabel here: ECharts types it on the CATEGORY axis only, and a
    // value axis already puts its ticks on the labels.
    axisTick: {
      show: yAxisSlot.present && !isLoading && !yAxisSlot.hideDots,
      length: 0.5,
      lineStyle: { color: tickDotColor, width: 3, cap: "round" },
    },
    splitLine: {
      // Hidden while loading — the skeleton floats on a clean canvas.
      show: showGrid && !isLoading,
      lineStyle: {
        color: splitLineColor,
        type: [3, 3] as [number, number],
        width: 1,
      },
    },
    axisLabel: {
      // Hidden while loading — skeleton values are meaningless, and the
      // Recharts YAxis unmounts during loading too.
      show: yAxisSlot.present && !isLoading,
      color: axisLabelColor,
      fontSize: 10,
      margin: 8,
      formatter: yTickFormatter
        ? (value: number, index: number) => yTickFormatter(value, index)
        : undefined,
    },
  };

  return { xAxis, yAxis };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tooltip HTML builder, closed over the build context. `trigger: "axis"` hands
 * the formatter every series' value at the hovered x; buffer overlays and the
 * mini/loading series are folded out here.
 */
export function createTooltipFormatter(ctx: OptionBuildContext) {
  const { config, selectedDataKey, tooltipSlot, getHoveredKey } = ctx;

  return (params: unknown): string => {
    const rows = Array.isArray(params) ? params : [params];
    if (!rows.length) return "";

    const first = rows[0] as { axisValue?: string | number; name?: string };
    // Label shows the RAW axis value — matches ChartTooltipContent.
    const axisValue = first.axisValue ?? first.name ?? "";
    const label = String(axisValue);

    // Dedupe by effective key: a buffer line contributes both its solid part
    // (id=key) and its dashed overlay (id=`__buffer-{key}`) at the shared
    // second-to-last point. Keep the first non-null value seen per key so the
    // final point (only the overlay has data there) still shows its number.
    const seen = new Set<string>();
    const body = rows
      .map((param) => {
        const p = param as {
          seriesId?: string;
          seriesName?: string;
          value?: number | string | null;
        };
        const rawId = String(p.seriesId ?? "");
        // Map the dashed buffer overlay back onto its series; drop every other
        // internal series (mini chart, loading skeleton, reveal base).
        const key = rawId.startsWith(BUFFER_PREFIX)
          ? rawId.slice(BUFFER_PREFIX.length)
          : rawId.startsWith("__")
            ? ""
            : (p.seriesId ?? p.seriesName ?? "");
        if (!key) return "";
        // A null value means this series does not reach the hovered x (a buffer
        // line's solid part stops before the last point) — skip it, and let the
        // overlay row for the same key stand in.
        if (p.value === null || p.value === undefined) return "";
        if (seen.has(key)) return "";
        seen.add(key);

        const item = config[key];
        const colorsCount = item ? getColorsCount(item) : 1;
        const labelText =
          typeof item?.label === "string" ? item.label : (p.seriesName ?? key);
        const hovered = getHoveredKey();
        const dimmed =
          (selectedDataKey != null && selectedDataKey !== key) ||
          (hovered != null && hovered !== key)
            ? " opacity-30"
            : "";
        const value =
          typeof p.value === "number" ? p.value.toLocaleString() : String(p.value ?? "");

        return tooltipRow({
          indicatorHtml: tooltipIndicatorHtml(key, colorsCount),
          labelText,
          valueText: value,
          dimmed,
        });
      })
      .join("");

    return tooltipShell({
      label,
      body,
      roundness: tooltipSlot.roundness,
      variant: tooltipSlot.variant,
    });
  };
}

export function buildTooltipOption(ctx: OptionBuildContext): TooltipComponentOption {
  const { tooltipSlot, isLoading } = ctx;
  const { tokens } = ctx.resolved;

  return {
    ...tooltipBaseOption({
      present: tooltipSlot.present && !isLoading,
      cursor: tooltipSlot.cursor,
      tokens,
      position: tooltipSlot.position,
      axisPointerColor: withAlpha(tokens.border, AXIS_POINTER_OPACITY),
      strokeWidth: STROKE_WIDTH,
    }),
    formatter: createTooltipFormatter(ctx),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Brush
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The evil-brush "line" look, canvas-style: a real mini chart of the full data
 * (strokes only, no fill) in a second grid, with a transparent slider dataZoom
 * laid over it. Both zoom entries target only the MAIN x-axis, so the mini
 * chart never filters itself.
 */
export function buildBrushOption(
  ctx: OptionBuildContext,
  brushBottom: number,
): {
  miniGrid: GridComponentOption;
  miniXAxis: XAxisOption;
  miniYAxis: YAxisOption;
  miniSeries: LineSeriesOption[];
  dataZoom: DataZoomComponentOption[];
} {
  const { data, lines, curveType, selectedDataKey, brushHeight, categories } = ctx;
  const { tokens } = ctx.resolved;

  const miniGrid: GridComponentOption = {
    left: 8,
    right: 8,
    bottom: brushBottom,
    height: brushHeight,
    // No visible axes here — opt out of label containment so the mini chart
    // spans the full brush frame.
    outerBoundsMode: "none",
  };

  const miniXAxis: XAxisOption = {
    type: "category",
    gridIndex: 1,
    boundaryGap: false,
    show: false,
    data: categories,
    axisPointer: { show: false },
  };

  const miniYAxis: YAxisOption = { type: "value", gridIndex: 1, show: false };

  const miniSeries: LineSeriesOption[] = lines.map((line) => {
    const key = line.dataKey;
    const base = (ctx.resolved.series[key] ?? [])[0] ?? FALLBACK_SERIES_COLOR;
    const curve = curveConfig(line.curveType ?? curveType);
    // The mini chart mirrors the click selection: unselected series recede by
    // the same ratio as the main plot.
    const strokeDim = getOpacity(selectedDataKey, key).stroke;

    return {
      id: `__mini-${key}`,
      type: "line",
      xAxisIndex: 1,
      yAxisIndex: 1,
      data: data.map((row) => Number(row[key]) || 0),
      smooth: curve.smooth,
      step: curve.step,
      connectNulls: line.connectNulls,
      silent: true,
      showSymbol: false,
      emphasis: { disabled: true },
      tooltip: { show: false },
      lineStyle: {
        color: base,
        width: 1,
        opacity: BRUSH_STROKE_OPACITY * strokeDim,
      },
      z: 0,
    };
  });

  const dataZoom = buildBrushDataZoom({
    brushBottom,
    brushHeight,
    brushRange: ctx.brushRange,
    fillerColor: withAlpha(tokens.foreground, BRUSH_FILLER_OPACITY),
  });

  return { miniGrid, miniXAxis, miniYAxis, miniSeries, dataZoom };
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ONE grey wave regardless of declared lines (Recharts parity: its skeleton is
 * a single stroke-only LoadingLine), swept by the shimmer rAF. No fill: a
 * `<Line>` has no area, so the skeleton is stroke-only too.
 */
export function buildLoadingOption(
  ctx: OptionBuildContext,
  frame: { grid: GridComponentOption; xAxis: XAxisOption; yAxis: YAxisOption },
): EChartsOption {
  const { tokens } = ctx.resolved;
  const curve = curveConfig(ctx.curveType);

  return {
    animation: false,
    grid: frame.grid,
    xAxis: frame.xAxis,
    yAxis: frame.yAxis,
    tooltip: { show: false },
    series: [
      {
        id: "__loading",
        type: "line",
        data: ctx.loadingData(),
        smooth: curve.smooth,
        step: curve.step,
        showSymbol: false,
        silent: true,
        // Invisible until the first shimmer tick positions the clip window.
        lineStyle: { color: withAlpha(tokens.foreground, 0), width: 1 },
        z: 1,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Line series — the core builder
// ─────────────────────────────────────────────────────────────────────────────

export function buildLineSeries(ctx: OptionBuildContext): LineSeriesOption[] {
  const {
    data,
    config,
    lines,
    curveType,
    selectedDataKey,
    hasSelection,
    enableHoverHighlight,
    enableHoverReveal,
    revealIndex,
    revealSink,
    resolved,
    rendererSize,
  } = ctx;
  const background = resolved.tokens.background;

  return lines.flatMap((line): LineSeriesOption[] => {
    const key = line.dataKey;
    const slots = resolved.series[key] ?? [FALLBACK_SERIES_COLOR];
    const paint = seriesPaint(slots);
    const isSelected = selectedDataKey === key;
    const opacity = getOpacity(selectedDataKey, key);
    const curve = curveConfig(line.curveType ?? curveType);
    const multiColor = slots.length > 1;

    const restingDot = dotStyle(line.dotVariant, paint, background);
    const activeDot = dotStyle(line.activeDotVariant, paint, background);
    const restingVisible = line.dotVariant !== "none";
    const dotOpacity = opacity.dot;

    const values = data.map((row) => Number(row[key]) || 0);
    const n = values.length;
    // Hover-reveal is a root-level mode and owns the whole line rendering, so it
    // takes precedence over a per-line buffer tail (and the glow overlay).
    const reveal = enableHoverReveal;
    const buffer = !reveal && line.enableBufferLine && n >= 2;
    const revealActive = reveal && revealIndex !== null;

    // The dash pattern for the MAIN line. A buffer line keeps its body solid and
    // dashes only the tail overlay, so its main part is always solid regardless
    // of strokeVariant (matches the Recharts twin).
    const mainDash: "solid" | [number, number] =
      buffer || line.strokeVariant === "solid" ? "solid" : [3, 3];

    // The reveal truncates the line to the cursor, which would COMPRESS a
    // bbox-relative stroke gradient into the shorter span — misaligning it from
    // the index-sampled dots. Anchor the stroke to the plot in absolute pixels
    // so every x keeps its own colour even when the line stops short.
    const strokePaint =
      reveal && multiColor
        ? new echarts.graphic.LinearGradient(
            8,
            0,
            Math.max(rendererSize.width - 8, 9),
            0,
            slots.map((color, i) => ({ offset: i / (slots.length - 1), color })),
            true,
          )
        : paint;

    // Turn a value list into ECharts data — attaching per-datum symbol colours
    // for multi-colour lines, and passing `null` gaps through so a buffer line's
    // two parts each draw only their own segment.
    const toPoints = (vals: (number | null)[]): LinePoint[] =>
      !multiColor
        ? vals
        : vals.map((value, i): LinePoint => {
            if (value === null) return null;
            const t = vals.length > 1 ? i / (vals.length - 1) : 0;
            const pointColor = sampleGradient(slots, t);
            return {
              value,
              itemStyle: {
                ...dotItemStyle(
                  restingVisible ? line.dotVariant : line.activeDotVariant,
                  pointColor,
                  background,
                ),
                opacity: dotOpacity,
              },
              emphasis: {
                itemStyle: {
                  ...dotItemStyle(
                    line.activeDotVariant === "none" ? "default" : line.activeDotVariant,
                    pointColor,
                    background,
                  ),
                  opacity: 1,
                },
              },
            };
          });

    // Snapshot the FULL per-datum points so the reveal hover handler can slice
    // them without losing each dot's sampled gradient colour — plain values
    // would fall back to the default palette.
    if (reveal) revealSink[key] = toPoints(values);

    // Buffer line: the solid MAIN part drops the last point (its final segment
    // becomes the dashed overlay). Reveal instead TRUNCATES the real series at
    // the cursor's x-index, so its line stops there and the muted base shows
    // through past it. When idle the real series carries its full data.
    const mainValues: (number | null)[] = buffer
      ? values.map((v, i) => (i === n - 1 ? null : v))
      : revealActive
        ? sliceToNull(values, revealIndex as number)
        : values;

    const z = isSelected ? 3 : hasSelection ? 1 : 2;

    // Glow overlays sit UNDER the real line (built first, same z; equal-z series
    // paint in array order). They follow the FULL solid path so the halo stays
    // continuous even beneath a dashed or buffer tail. Suppressed under reveal:
    // a full-length coloured halo would bleed past the cursor and defeat the mute.
    const glowSeries =
      line.glowing && !reveal
        ? buildGlowSeries({
            key,
            paint,
            slots,
            values,
            curve,
            connectNulls: line.connectNulls,
            z,
            selectionDim: opacity.stroke,
            dotSize: restingVisible ? restingDot.size : 0,
          })
        : [];

    const mainSeries: LineSeriesOption = {
      id: key,
      name: typeof config[key]?.label === "string" ? config[key]?.label : key,
      type: "line",
      data: toPoints(mainValues),
      smooth: curve.smooth,
      step: curve.step,
      connectNulls: line.connectNulls,
      cursor: line.isClickable ? "pointer" : "default",
      // By default ECharts only fires mouse events on the symbols — this makes
      // the line itself clickable too, like the Recharts <Line>.
      triggerEvent: line.isClickable,
      showSymbol: restingVisible,
      symbol: "circle",
      symbolSize: restingVisible ? restingDot.size : activeDot.size,
      z,
      lineStyle: {
        color: strokePaint,
        width: line.strokeWidth,
        opacity: opacity.stroke,
        type: mainDash,
        dashOffset: 0,
      },
      itemStyle: multiColor
        ? { opacity: dotOpacity }
        : {
            ...(restingVisible ? restingDot.itemStyle : activeDot.itemStyle),
            opacity: dotOpacity,
          },
      emphasis: {
        // focus "series" blurs every other series in this grid while one is
        // hovered — the hover twin of the click selection. Suppressed entirely
        // while a series is click-selected: the selection dim owns the canvas.
        // Reveal owns the hover visual, so native focus-blur stands down when it
        // is on (they must not blend).
        focus:
          enableHoverHighlight && !enableHoverReveal && !hasSelection ? "series" : "none",
        scale: restingVisible ? activeDot.size / Math.max(restingDot.size, 1) : 1,
        ...(multiColor ? {} : { itemStyle: { ...activeDot.itemStyle, opacity: 1 } }),
      },
      // Blur styling mirrors the click-selection dim; inert unless a series is
      // focused via enableHoverHighlight.
      blur: {
        lineStyle: { opacity: 0.3 },
        itemStyle: { opacity: 0.3 },
      },
    };

    // Hover-reveal: a muted grey BASE line of the FULL series sits one z below
    // the real one. Invisible while idle (opacity 0 → the chart looks normal),
    // fading in only while hovering, so the region PAST the cursor shows as
    // neutral grey. Lines have no fill, so the base is a line only.
    if (reveal) {
      const muted = resolved.tokens.mutedForeground;
      const revealBase: LineSeriesOption = {
        id: `${REVEAL_PREFIX}${key}`,
        type: "line",
        // Only the region FROM the cursor onward, so the grey never sits under
        // the coloured part — the two meet exactly at the pointer.
        data: revealActive ? sliceFrom(values, revealIndex as number) : values,
        smooth: curve.smooth,
        step: curve.step,
        connectNulls: false,
        silent: true,
        showSymbol: false,
        symbol: "circle",
        z: z - 1,
        lineStyle: {
          color: muted,
          width: line.strokeWidth,
          type: mainDash,
          opacity: revealActive ? 0.3 : 0,
        },
        emphasis: { disabled: true },
        blur: { lineStyle: { opacity: revealActive ? 0.3 : 0 } },
        tooltip: { show: false },
      };
      return [revealBase, mainSeries];
    }

    if (!buffer) return [...glowSeries, mainSeries];

    // Dashed forecast overlay — draws ONLY the last segment. Silent, so it never
    // intercepts clicks/hover; it still feeds the axis tooltip (silent series are
    // aggregated by axis), which is why the last point keeps its number.
    const bufferValues: (number | null)[] = values.map((v, i) => (i >= n - 2 ? v : null));
    const bufferSeries: LineSeriesOption = {
      id: `${BUFFER_PREFIX}${key}`,
      type: "line",
      data: toPoints(bufferValues),
      smooth: curve.smooth,
      step: curve.step,
      connectNulls: true,
      silent: true,
      showSymbol: restingVisible,
      symbol: "circle",
      symbolSize: restingVisible ? restingDot.size : activeDot.size,
      z,
      lineStyle: {
        color: paint,
        width: line.strokeWidth,
        opacity: opacity.stroke,
        type: BUFFER_DASH,
      },
      itemStyle: multiColor
        ? { opacity: dotOpacity }
        : {
            ...(restingVisible ? restingDot.itemStyle : activeDot.itemStyle),
            opacity: dotOpacity,
          },
      // The dashed tail is a separate silent series, so focus:"series" on its
      // parent would blur it apart from the line it belongs to. The component
      // dispatch-links this id so it focuses WITH its parent.
      emphasis: {
        focus: "none",
        scale: false,
        lineStyle: { opacity: opacity.stroke },
        itemStyle: { opacity: dotOpacity },
      },
      blur: { lineStyle: { opacity: 0.3 }, itemStyle: { opacity: 0.3 } },
    };

    return [...glowSeries, mainSeries, bufferSeries];
  });
}
