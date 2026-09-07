/**
 * Apache ECharts composed chart for Solid — bars and lines on one axis.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-composed-chart.tsx` (MIT).
 * See ../line-chart/line-chart.tsx for the shared React → Solid notes.
 */
import {
  Show,
  children,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  mergeProps,
  on,
  onCleanup,
  onMount,
  type JSX,
} from "solid-js";
import * as echarts from "echarts/core";

import { getLoadingData } from "../../lib/chart-series";
import { buildChartCss, resolveColors, type ResolvedColors } from "../../lib/chart-tokens";
import {
  syncBrushOverlay,
  type BrushGeometry,
  type BrushOverlayElements,
  type BrushRange,
} from "../../lib/echarts-brush";
import { LegendOverlay } from "../../lib/echarts-legend";
import { DEFAULT_ECHARTS_RENDERER } from "../../lib/echarts-paint";
import {
  ActiveDot,
  Bar,
  Brush,
  Dot,
  Grid,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
  collectConfig,
} from "./parts";
import {
  buildBarSeries,
  buildBrushOption,
  buildChartLayout,
  buildLineGlowSeries,
  buildLineSeries,
  buildLoadingOption,
  buildMainAxes,
  buildTooltipOption,
  shimmerWindowStops,
  type EChartsOption,
  type OptionBuildContext,
} from "./options";
import {
  DASH_PERIOD,
  LOADING_ANIMATION_DURATION,
  LOADING_BAR_MAX_OPACITY,
  LOADING_DEFAULT_BARS,
  LOADING_LINE_MAX_OPACITY,
  LOADING_LINE_WIDTH,
  REVEAL_DURATION,
  type EChartsComposedChartProps,
} from "./types";

type EChartsInstance = ReturnType<typeof echarts.init>;

type LiveState = {
  resolved: ResolvedColors | null;
  hoveredKey: string | null;
  hasRevealed: boolean;
  revealEndsAt: number;
  loadingRows: number[] | null;
  loadingLineRows: number[] | null;
  categories: string[];
  dataLength: number;
  brushRange: BrushRange;
  brushGeom: BrushGeometry | null;
  brushOverlay: BrushOverlayElements | null;
  brushHover: { inside: boolean; left: boolean; right: boolean };
  handlers: {
    onBrushChange?: (range: { startIndex: number; endIndex: number }) => void;
    clickableKeys: Set<string>;
    selectedDataKey: string | null;
    brushFormatLabel?: (value: string, index: number) => string;
    /** Bars then lines — the order the option array uses for the index map. */
    seriesKeys: string[];
  };
  repush: () => void;
};

function createReducedMotion() {
  const [reduced, setReduced] = createSignal(false);
  onMount(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    onCleanup(() => query.removeEventListener("change", onChange));
  });
  return reduced;
}

function EChartsComposedChartRoot<TData extends Record<string, unknown>>(
  rawProps: EChartsComposedChartProps<TData>,
): JSX.Element {
  const props = mergeProps(
    {
      renderer: DEFAULT_ECHARTS_RENDERER,
      curveType: "linear" as const,
      animation: true,
      animationType: "left-to-right" as const,
      defaultSelectedDataKey: null,
      isLoading: false,
      loadingBars: LOADING_DEFAULT_BARS,
    },
    rawProps,
  );

  const chartId = `chart-${createUniqueId().replace(/:/g, "")}`;

  let containerRef!: HTMLDivElement;
  let mountRef!: HTMLDivElement;
  let chartInstance: EChartsInstance | null = null;

  const live: LiveState = {
    resolved: null,
    hoveredKey: null,
    hasRevealed: false,
    revealEndsAt: 0,
    loadingRows: null,
    loadingLineRows: null,
    categories: [],
    dataLength: 0,
    brushRange: { start: 0, end: 100 },
    brushGeom: null,
    brushOverlay: null,
    brushHover: { inside: false, left: false, right: false },
    handlers: {
      onBrushChange: undefined,
      clickableKeys: new Set<string>(),
      selectedDataKey: props.defaultSelectedDataKey,
      brushFormatLabel: undefined,
      seriesKeys: [],
    },
    repush: () => {},
  };

  const loadingData = () => (live.loadingRows ??= getLoadingData(props.loadingBars));
  // A second, independent walk — the skeleton line must not trace the bar tops.
  const loadingLineData = () =>
    (live.loadingLineRows ??= getLoadingData(props.loadingBars));

  const reducedMotion = createReducedMotion();

  const [selectedDataKey, setSelectedDataKey] = createSignal<string | null>(
    props.defaultSelectedDataKey,
  );
  const [hoveredDataKey] = createSignal<string | null>(null);
  const [chartEpoch, setChartEpoch] = createSignal(0);

  const resolvedChildren = children(() => props.children);
  const collected = createMemo(() => collectConfig(resolvedChildren()));

  const bars = () => collected().bars;
  const lines = () => collected().lines;
  const xAxisSlot = () => collected().xAxis;
  const yAxisSlot = () => collected().yAxis;
  const showGrid = () => collected().showGrid;
  const tooltipSlot = () => collected().tooltip;
  const legendSlot = () => collected().legend;
  const brushSlot = () => collected().brush;

  const showBrush = () => brushSlot().present;
  const brushHeight = () => brushSlot().height ?? 56;

  // Bars first, then lines — the same order buildOption emits, so a click's
  // seriesIndex maps straight back to a key.
  const seriesKeys = createMemo(() => [
    ...bars().map((bar) => bar.dataKey),
    ...lines().map((line) => line.dataKey),
  ]);

  const xCategoryKey = createMemo(() => {
    const fromAxis = xAxisSlot().dataKey;
    if (fromAxis) return fromAxis;
    if (props.xDataKey) return props.xDataKey as string;
    const firstRow = props.data[0];
    if (firstRow) {
      const claimed = new Set(seriesKeys());
      const found = Object.keys(firstRow).find((key) => !claimed.has(key));
      if (found) return found;
    }
    return "";
  });

  /** The first declared series drives the chart's entrance. */
  const effectiveAnimation = () =>
    bars()[0]?.animationType ?? lines()[0]?.animationType ?? props.animationType;

  const css = createMemo(() => buildChartCss(chartId, props.config));

  const clickableKeys = createMemo(
    () =>
      new Set([
        ...bars().filter((b) => b.isClickable).map((b) => b.dataKey),
        ...lines().filter((l) => l.isClickable).map((l) => l.dataKey),
      ]),
  );

  createEffect(() => {
    live.handlers = {
      onBrushChange: brushSlot().onChange,
      clickableKeys: clickableKeys(),
      selectedDataKey: selectedDataKey(),
      brushFormatLabel: brushSlot().formatLabel,
      seriesKeys: seriesKeys(),
    };
    live.dataLength = props.data.length;
  });

  const toggleSelection = (key: string) => {
    setSelectedDataKey((prev) => {
      const next = prev === key ? null : key;
      props.onSelectionChange?.(next);
      return next;
    });
  };

  const syncBrushOverlayNow = () => {
    const chart = chartInstance;
    if (!chart) return;

    const geom = live.brushGeom;
    const tokens = live.resolved?.tokens;
    if (!geom || !tokens) {
      syncBrushOverlay(chart, live, null);
      return;
    }

    const range = live.brushRange;
    const categories = live.categories;
    const format = live.handlers.brushFormatLabel;
    const lastIndex = Math.max(categories.length - 1, 0);
    const startIndex = Math.round((range.start / 100) * lastIndex);
    const endIndex = Math.round((range.end / 100) * lastIndex);
    const labels =
      format && categories.length
        ? {
            start: format(categories[startIndex] ?? "", startIndex),
            end: format(categories[endIndex] ?? "", endIndex),
          }
        : null;

    syncBrushOverlay(chart, live, {
      range,
      geom,
      size: { width: chart.getWidth(), height: chart.getHeight() },
      tokens,
      labels,
      showLabels: live.brushHover.inside,
      hover: live.brushHover,
    });
  };

  const buildOption = (): EChartsOption => {
    const resolved = live.resolved;
    if (!resolved) return {};

    const categories = props.data.map((row) => String(row[xCategoryKey()]));
    live.categories = categories;

    const ctx: OptionBuildContext = {
      data: props.data,
      config: props.config,
      bars: bars(),
      lines: lines(),
      seriesKeys: seriesKeys(),
      curveType: props.curveType,
      animationType: props.animationType,
      selectedDataKey: selectedDataKey(),
      showGrid: showGrid(),
      xAxisSlot: xAxisSlot(),
      yAxisSlot: yAxisSlot(),
      tooltipSlot: tooltipSlot(),
      legendSlot: legendSlot(),
      isLoading: props.isLoading,
      loadingData,
      loadingLineData,
      showBrush: showBrush(),
      brushHeight: brushHeight(),
      barGap: props.barGap,
      barCategoryGap: props.barCategoryGap,
      resolved,
      categories,
      brushRange: live.brushRange,
      getHoveredKey: () => live.hoveredKey,
    };

    const { grid, brushBottom } = buildChartLayout(ctx);
    live.brushGeom = showBrush() ? { bottom: brushBottom, height: brushHeight() } : null;

    const { xAxis, yAxis } = buildMainAxes(ctx);

    if (props.isLoading) return buildLoadingOption(ctx, { grid, xAxis, yAxis });

    const brush = showBrush() ? buildBrushOption(ctx, brushBottom) : null;

    return {
      animation: false,
      grid: brush ? [grid, brush.miniGrid] : grid,
      xAxis: brush ? [xAxis, brush.miniXAxis] : xAxis,
      yAxis: brush ? [yAxis, brush.miniYAxis] : yAxis,
      tooltip: buildTooltipOption(ctx),
      dataZoom: brush?.dataZoom,
      // Bars before lines so the polyline strokes read above the columns. Glow
      // copies come AFTER the main series — their z keeps them under the lines
      // and over the bars, and keeping them last preserves the seriesIndex → key
      // map that a line-body click depends on.
      series: [
        ...buildBarSeries(ctx),
        ...buildLineSeries(ctx),
        ...buildLineGlowSeries(ctx),
        ...(brush?.miniSeries ?? []),
      ],
    };
  };

  // ── Init + resize + theme observer, per renderer instance ───────────────────
  createEffect(
    on(
      () => props.renderer,
      (renderer) => {
        if (!mountRef || !containerRef) return;

        live.hoveredKey = null;
        live.brushHover = { inside: false, left: false, right: false };

        const chart = echarts.init(mountRef, null, { renderer });
        chartInstance = chart;

        const resizeObserver = new ResizeObserver(() => {
          if (
            mountRef.clientWidth === chart.getWidth() &&
            mountRef.clientHeight === chart.getHeight()
          ) {
            return;
          }
          chart.resize();
          live.repush();
        });
        resizeObserver.observe(mountRef);

        const themeObserver = new MutationObserver(() => live.repush());
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });

        chart.on("click", (params) => {
          const { clickableKeys: clickable, seriesKeys: keys } = live.handlers;
          const p = params as { seriesId?: string; seriesIndex?: number };
          // Symbol clicks carry seriesId; line-body clicks (triggerEvent) carry
          // only seriesIndex. Main series — bars then lines — come first in the
          // option array, so the index maps directly.
          const id =
            p.seriesId ??
            (typeof p.seriesIndex === "number" ? keys[p.seriesIndex] : undefined);
          if (typeof id === "string" && clickable.has(id)) toggleSelection(id);
        });

        chart.on("datazoom", () => {
          const option = chart.getOption() as {
            dataZoom?: { start?: number; end?: number }[];
          };
          const zoom = option.dataZoom?.[0];
          if (!zoom) return;

          live.brushRange = { start: zoom.start ?? 0, end: zoom.end ?? 100 };
          syncBrushOverlayNow();

          const { onBrushChange: onChange } = live.handlers;
          if (!onChange) return;
          const len = live.dataLength;
          const startIndex = Math.round(((zoom.start ?? 0) / 100) * (len - 1));
          const endIndex = Math.round(((zoom.end ?? 100) / 100) * (len - 1));
          onChange({ startIndex, endIndex });
        });

        const zr = chart.getZr();
        const applyBrushHover = (next: {
          inside: boolean;
          left: boolean;
          right: boolean;
        }) => {
          const prev = live.brushHover;
          if (
            prev.inside === next.inside &&
            prev.left === next.left &&
            prev.right === next.right
          ) {
            return;
          }
          live.brushHover = next;
          syncBrushOverlayNow();
        };
        const onZrMove = (event: { offsetX?: number; offsetY?: number }) => {
          const geom = live.brushGeom;
          if (!geom) return;
          const x = event.offsetX ?? -1;
          const y = event.offsetY ?? -1;
          const top = chart.getHeight() - geom.bottom - geom.height;
          const inside = y >= top - 4 && y <= top + geom.height + 4;
          const trackLeft = 8;
          const trackWidth = Math.max(chart.getWidth() - 16, 1);
          const { start, end } = live.brushRange;
          const selectionLeft = trackLeft + (trackWidth * start) / 100;
          const selectionRight = trackLeft + (trackWidth * end) / 100;
          applyBrushHover({
            inside,
            left: inside && Math.abs(x - selectionLeft) <= 8,
            right: inside && Math.abs(x - selectionRight) <= 8,
          });
        };
        const onZrOut = () =>
          applyBrushHover({ inside: false, left: false, right: false });
        zr.on("mousemove", onZrMove);
        zr.on("globalout", onZrOut);

        setChartEpoch((epoch) => epoch + 1);

        onCleanup(() => {
          zr.off("mousemove", onZrMove);
          zr.off("globalout", onZrOut);
          resizeObserver.disconnect();
          themeObserver.disconnect();
          chart.dispose();
          chartInstance = null;
          live.brushOverlay = null;
          live.hasRevealed = false;
        });
      },
    ),
  );

  // ── Sync: resolve colours, build, push ──────────────────────────────────────
  createEffect(() => {
    chartEpoch();
    const chart = chartInstance;
    if (!chart || !containerRef) return;

    const config = props.config;
    const keys = seriesKeys();
    const isLoading = props.isLoading;
    const animation = props.animation;
    const animType = effectiveAnimation();
    const reduce = reducedMotion();
    const options = props.chartOptions;
    void collected();
    void props.data;
    void selectedDataKey();
    void props.curveType;

    live.resolved = resolveColors(containerRef, config, keys);

    const push = (withEntrance: boolean) => {
      const option = buildOption();
      const merged = options ? { ...option, ...options } : option;
      Object.assign(merged, {
        animation: withEntrance,
        animationDuration: REVEAL_DURATION,
        animationDurationUpdate: 0,
      });
      chart.setOption(merged as EChartsOption, { notMerge: true });
      syncBrushOverlayNow();
    };

    if (isLoading) live.hasRevealed = false;
    const shouldReveal = !live.hasRevealed && !isLoading;
    if (shouldReveal) live.hasRevealed = true;
    const revealEnabled = animation && shouldReveal && animType !== "none" && !reduce;
    if (revealEnabled) live.revealEndsAt = performance.now() + REVEAL_DURATION;
    push(revealEnabled);

    live.repush = () => {
      live.resolved = resolveColors(containerRef, config, keys);
      push(false);
    };
  });

  // ── Animated dashed stroke ──────────────────────────────────────────────────
  createEffect(() => {
    chartEpoch();
    const chart = chartInstance;
    const isLoading = props.isLoading;
    const animatedKeys = lines()
      .filter((line) => line.strokeVariant === "animated-dashed")
      .map((line) => line.dataKey);

    if (!chart || isLoading || animatedKeys.length === 0) return;

    let raf = 0;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    const begin = () => {
      const loopStart = performance.now();
      const tick = (now: number) => {
        // The dashes crawl one full period per second.
        const offset = -(((now - loopStart) / 1000) % 1) * DASH_PERIOD;
        chart.setOption(
          {
            series: animatedKeys.map((id) => ({ id, lineStyle: { dashOffset: offset } })),
          },
          { silent: true, lazyUpdate: true },
        );
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    // Per-frame setOption churn fights the intro draw-in — hold until it ends.
    const delay = Math.max(0, live.revealEndsAt - performance.now());
    if (delay > 0) delayTimer = setTimeout(begin, delay + 50);
    else begin();

    onCleanup(() => {
      if (delayTimer !== undefined) clearTimeout(delayTimer);
      cancelAnimationFrame(raf);
    });
  });

  // ── Loading shimmer — ONE clip drives both the bars and the line ────────────
  createEffect(() => {
    chartEpoch();
    const chart = chartInstance;
    const isLoading = props.isLoading;
    const count = props.loadingBars;
    if (!chart || !isLoading) return;

    let raf = 0;
    let lastPhase = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const phase = ((((now - start) / LOADING_ANIMATION_DURATION) % 1) + 1) % 1;
      if (phase < lastPhase) {
        live.loadingRows = getLoadingData(count);
        live.loadingLineRows = getLoadingData(count);
      }
      lastPhase = phase;

      const foreground = live.resolved?.tokens.foreground ?? "rgba(120, 120, 120, 1)";
      const w = chart.getWidth();
      const h = chart.getHeight();
      if (!w || !h) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const maxT = (w + h) / (2 * w);
      const center = phase * (maxT + 2 * 0.2) - 0.2;
      // ABSOLUTE pixel coordinates, shared by both shapes — bbox-relative coords
      // would put the window in a different place for the bars than the line,
      // and they would light up out of step.
      const clip = (peak: number) =>
        new echarts.graphic.LinearGradient(
          0,
          0,
          w,
          w,
          shimmerWindowStops(center, foreground, peak),
          true,
        );
      chart.setOption(
        {
          series: [
            {
              id: "__loading",
              data: loadingData(),
              itemStyle: { color: clip(LOADING_BAR_MAX_OPACITY) },
            },
            {
              id: "__loading-line",
              data: loadingLineData(),
              lineStyle: {
                color: clip(LOADING_LINE_MAX_OPACITY),
                width: LOADING_LINE_WIDTH,
              },
            },
          ],
        },
        { silent: true, lazyUpdate: true },
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    onCleanup(() => cancelAnimationFrame(raf));
  });

  const legendStyle = (): JSX.CSSProperties => ({
    position: "absolute",
    left: "16px",
    right: "16px",
    "pointer-events": "auto",
    ...(legendSlot().verticalAlign === "top"
      ? { top: "12px" }
      : legendSlot().verticalAlign === "bottom"
        ? { bottom: showBrush() ? `${brushHeight() + 16}px` : "12px" }
        : { top: "50%", transform: "translateY(-50%)" }),
  });

  return (
    <div
      ref={containerRef}
      data-chart={chartId}
      class={`relative flex flex-col text-xs ${props.class ?? ""}`}
    >
      <style innerHTML={css()} />

      <div class="relative min-h-0 w-full flex-1">
        <div ref={mountRef} class="h-full min-h-0 w-full" />
      </div>

      <Show when={legendSlot().present && !props.isLoading}>
        <LegendOverlay
          seriesKeys={seriesKeys()}
          config={props.config}
          variant={legendSlot().variant}
          align={legendSlot().align}
          verticalAlign={legendSlot().verticalAlign}
          selectedKey={selectedDataKey()}
          hoveredKey={hoveredDataKey()}
          isClickable={legendSlot().isClickable}
          onToggle={toggleSelection}
          style={legendStyle()}
        />
      </Show>

      <Show when={props.isLoading}>
        <div class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div
            class={`text-primary bg-background flex items-center justify-center gap-2 rounded-md border px-2 py-0.5 text-sm ${
              reducedMotion() ? "" : "animate-in fade-in zoom-in-95 duration-200"
            }`}
          >
            <div class="border-border border-t-primary h-3 w-3 animate-spin rounded-full border" />
            <span>Loading</span>
          </div>
        </div>
      </Show>
    </div>
  );
}

/** Compound API — every part hangs off the root as a static member. */
export const EChartsComposedChart = Object.assign(EChartsComposedChartRoot, {
  Bar,
  Line,
  Dot,
  ActiveDot,
  XAxis,
  YAxis,
  Grid,
  Tooltip,
  Legend,
  Brush,
});
