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

import { buildChartCss, resolveColors, type ResolvedColors } from "../../lib/chart-tokens";
import { LegendOverlay } from "../../lib/echarts-legend";
import { DEFAULT_ECHARTS_RENDERER } from "../../lib/echarts-paint";
import {
  buildLoadingOption,
  buildRadarComponent,
  buildRadarSeries,
  buildTooltipOption,
  computeIndicatorMax,
  getLoadingData,
  shimmerWindowStops,
  type EChartsOption,
  type OptionBuildContext,
} from "./options";
import {
  ActiveDot,
  Dot,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  collectConfig,
} from "./parts";
import {
  LOADING_ANIMATION_DURATION,
  LOADING_DEFAULT_POINTS,
  LOADING_SHIMMER_MAX_OPACITY,
  LOADING_STROKE_OPACITY,
  REVEAL_DURATION,
  type EChartsRadarChartProps,
} from "./types";

/**
 * Apache ECharts radar chart for Solid.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-radar-chart.tsx` (MIT).
 * See ../line-chart/line-chart.tsx for the shared React → Solid notes.
 */

type EChartsInstance = ReturnType<typeof echarts.init>;

type LiveState = {
  resolved: ResolvedColors | null;
  hasRevealed: boolean;
  loadingRows: number[] | null;
  categories: string[];
  handlers: { clickableKeys: Set<string>; seriesKeys: string[] };
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

function EChartsRadarChartRoot<TData extends Record<string, unknown>>(
  rawProps: EChartsRadarChartProps<TData>,
): JSX.Element {
  const props = mergeProps(
    {
      renderer: DEFAULT_ECHARTS_RENDERER,
      animation: true,
      defaultSelectedDataKey: null,
      isLoading: false,
      loadingPoints: LOADING_DEFAULT_POINTS,
    },
    rawProps,
  );

  const chartId = `chart-${createUniqueId().replace(/:/g, "")}`;

  let containerRef!: HTMLDivElement;
  let mountRef!: HTMLDivElement;
  let chartInstance: EChartsInstance | null = null;

  const live: LiveState = {
    resolved: null,
    hasRevealed: false,
    loadingRows: null,
    categories: [],
    handlers: { clickableKeys: new Set<string>(), seriesKeys: [] },
    repush: () => {},
  };

  const loadingData = () => (live.loadingRows ??= getLoadingData(props.loadingPoints));
  const reducedMotion = createReducedMotion();

  const [selectedDataKey, setSelectedDataKey] = createSignal<string | null>(
    props.defaultSelectedDataKey,
  );
  const [chartEpoch, setChartEpoch] = createSignal(0);

  const resolvedChildren = children(() => props.children);
  const collected = createMemo(() => collectConfig(resolvedChildren()));

  const radars = () => collected().radars;
  const gridSlot = () => collected().grid;
  const angleAxisSlot = () => collected().angleAxis;
  const radiusAxisSlot = () => collected().radiusAxis;
  const tooltipSlot = () => collected().tooltip;
  const legendSlot = () => collected().legend;

  const seriesKeys = createMemo(() => radars().map((radar) => radar.dataKey));

  /** `<PolarAngleAxis dataKey>` → first data column no `<Radar>` claims. */
  const angleKey = createMemo(() => {
    const fromAxis = angleAxisSlot().dataKey;
    if (fromAxis) return fromAxis;
    const firstRow = props.data[0];
    if (firstRow) {
      const claimed = new Set(seriesKeys());
      const found = Object.keys(firstRow).find((key) => !claimed.has(key));
      if (found) return found;
    }
    return "";
  });

  const categories = createMemo(() => props.data.map((row) => String(row[angleKey()])));

  const css = createMemo(() => buildChartCss(chartId, props.config));
  const hasSelection = () => selectedDataKey() !== null;

  const clickableKeys = createMemo(
    () => new Set(radars().filter((r) => r.isClickable).map((r) => r.dataKey)),
  );

  createEffect(() => {
    live.categories = categories();
    live.handlers = { clickableKeys: clickableKeys(), seriesKeys: seriesKeys() };
  });

  const toggleSelection = (key: string) => {
    setSelectedDataKey((prev) => {
      const next = prev === key ? null : key;
      props.onSelectionChange?.(next);
      return next;
    });
  };

  const buildOption = (): EChartsOption => {
    const resolved = live.resolved;
    if (!resolved) return {};

    const cats = categories();
    live.categories = cats;

    const ctx: OptionBuildContext = {
      data: props.data,
      config: props.config,
      radars: radars(),
      seriesKeys: seriesKeys(),
      selectedDataKey: selectedDataKey(),
      hasSelection: hasSelection(),
      gridSlot: gridSlot(),
      angleAxisSlot: angleAxisSlot(),
      radiusAxisSlot: radiusAxisSlot(),
      tooltipSlot: tooltipSlot(),
      legendSlot: legendSlot(),
      isLoading: props.isLoading,
      loadingData,
      loadingPoints: props.loadingPoints,
      resolved,
      categories: cats,
      // Every spoke shares one radius scale, so the largest value across all
      // series touches the outer ring — the Recharts default domain.
      indicatorMax: computeIndicatorMax(props.data, seriesKeys()),
    };

    if (props.isLoading) return buildLoadingOption(ctx);

    return {
      animation: false,
      radar: buildRadarComponent(ctx),
      tooltip: buildTooltipOption(ctx),
      series: buildRadarSeries(ctx),
    };
  };

  // ── Init + resize + theme observer, per renderer instance ───────────────────
  createEffect(
    on(
      () => props.renderer,
      (renderer) => {
        if (!mountRef || !containerRef) return;

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
          // Symbol clicks carry seriesId; polygon clicks may carry only
          // seriesIndex. Main series come first (the skeleton is silent), so the
          // index maps directly.
          const id =
            p.seriesId ??
            (typeof p.seriesIndex === "number" ? keys[p.seriesIndex] : undefined);
          if (typeof id === "string" && clickable.has(id)) toggleSelection(id);
        });

        setChartEpoch((epoch) => epoch + 1);

        onCleanup(() => {
          resizeObserver.disconnect();
          themeObserver.disconnect();
          chart.dispose();
          chartInstance = null;
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
    const reduce = reducedMotion();
    const options = props.chartOptions;
    void collected();
    void props.data;
    void selectedDataKey();

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
    };

    if (isLoading) live.hasRevealed = false;
    const shouldReveal = !live.hasRevealed && !isLoading;
    if (shouldReveal) live.hasRevealed = true;
    push(animation && shouldReveal && !reduce);

    live.repush = () => {
      live.resolved = resolveColors(containerRef, config, keys);
      push(false);
    };
  });

  // ── Default tooltip — reveals a SERIES, not a category ──────────────────────
  createEffect(() => {
    chartEpoch();
    const chart = chartInstance;
    const slot = tooltipSlot();
    const index = slot.defaultIndex;
    void props.data.length;
    void seriesKeys().length;
    if (!chart || props.isLoading || !slot.present || index == null) return;

    const timer = setTimeout(() => {
      // Item-triggered per polygon, so `defaultIndex` picks which SERIES opens —
      // dataIndex stays 0 because each radar series holds exactly one item.
      chart.dispatchAction({ type: "showTip", seriesIndex: index, dataIndex: 0 });
    }, 300);
    onCleanup(() => clearTimeout(timer));
  });

  // ── Loading shimmer ─────────────────────────────────────────────────────────
  createEffect(() => {
    chartEpoch();
    const chart = chartInstance;
    const isLoading = props.isLoading;
    const points = props.loadingPoints;
    if (!chart || !isLoading) return;

    let raf = 0;
    let lastPhase = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const phase = ((((now - start) / LOADING_ANIMATION_DURATION) % 1) + 1) % 1;
      if (phase < lastPhase) live.loadingRows = getLoadingData(points);
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
              data: [{ value: loadingData() }],
              lineStyle: { color: clip(LOADING_STROKE_OPACITY), width: 2 },
              areaStyle: { color: clip(LOADING_SHIMMER_MAX_OPACITY) },
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
        ? { bottom: "12px" }
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
          hoveredKey={null}
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
export const EChartsRadarChart = Object.assign(EChartsRadarChartRoot, {
  Radar,
  Dot,
  ActiveDot,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  Legend,
});
