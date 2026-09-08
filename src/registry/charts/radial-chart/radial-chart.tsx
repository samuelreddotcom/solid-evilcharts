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

import { BackgroundLayer } from "../../lib/chart-background";
import { buildChartCss, resolveColors, type ResolvedColors } from "../../lib/chart-tokens";
import { LegendOverlay } from "../../lib/echarts-legend";
import { DEFAULT_ECHARTS_RENDERER } from "../../lib/echarts-paint";
import {
  buildAngleAxis,
  buildBarSeries,
  buildLoadingOption,
  buildPolar,
  buildRadiusAxis,
  buildTooltipOption,
  getLoadingData,
  niceCeil,
  shimmerWindowStops,
  type EChartsOption,
  type OptionBuildContext,
} from "./options";
import { Legend, RadialBar, Tooltip, collectConfig } from "./parts";
import {
  DEFAULT_INNER_RADIUS,
  DEFAULT_OUTER_RADIUS,
  LOADING_ANIMATION_DURATION,
  LOADING_BARS,
  LOADING_SERIES_ID,
  LOADING_SHIMMER_MAX_OPACITY,
  MAIN_SERIES_ID,
  REVEAL_DURATION,
  type EChartsRadialChartProps,
} from "./types";

/**
 * Apache ECharts radial chart for Solid.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-radial-chart.tsx` (MIT).
 * See ../line-chart/line-chart.tsx for the shared React → Solid notes.
 *
 * Polar like the pie, but built on a BAR series over a polar coordinate system
 * rather than a pie series — so it has real angle and radius axes, and a second
 * polar carrying nothing but the background track.
 */

type EChartsInstance = ReturnType<typeof echarts.init>;

type LiveState = {
  resolved: ResolvedColors | null;
  hasRevealed: boolean;
  loadingRows: number[] | null;
  categories: string[];
  handlers: { clickable: boolean };
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

function EChartsRadialChartRoot<TData extends Record<string, unknown>>(
  rawProps: EChartsRadialChartProps<TData>,
): JSX.Element {
  const props = mergeProps(
    {
      renderer: DEFAULT_ECHARTS_RENDERER,
      variant: "full" as const,
      innerRadius: DEFAULT_INNER_RADIUS,
      outerRadius: DEFAULT_OUTER_RADIUS,
      defaultSelectedDataKey: null,
      isLoading: false,
    },
    rawProps,
  );

  const baseId = createUniqueId().replace(/:/g, "");
  const chartId = `chart-${baseId}`;

  let containerRef!: HTMLDivElement;
  let mountRef!: HTMLDivElement;
  let chartInstance: EChartsInstance | null = null;

  const live: LiveState = {
    resolved: null,
    hasRevealed: false,
    loadingRows: null,
    categories: [],
    handlers: { clickable: false },
    repush: () => {},
  };

  const loadingData = () => (live.loadingRows ??= getLoadingData(LOADING_BARS));
  const reducedMotion = createReducedMotion();

  const [selectedBar, setSelectedBar] = createSignal<string | null>(
    props.defaultSelectedDataKey,
  );
  const [chartEpoch, setChartEpoch] = createSignal(0);

  const resolvedChildren = children(() => props.children);
  const collected = createMemo(() => collectConfig(resolvedChildren()));

  const radialBar = () => collected().radialBar;
  const tooltipSlot = () => collected().tooltip;
  const legendSlot = () => collected().legend;

  /** Ring NAMES are the config keys — same convention as the pie's sectors. */
  const categories = createMemo(() => props.data.map((row) => String(row[props.nameKey])));

  const values = createMemo(() => {
    const key = radialBar().dataKey;
    return props.data.map((row) => (key ? Number(row[key]) || 0 : 0));
  });

  /**
   * An explicit `max` pins what a full sweep means (gauges). Otherwise a nice
   * ceiling over the data, so the largest ring stops just shy of a full wrap.
   */
  const angleMax = createMemo(() =>
    props.max != null && props.max > 0
      ? props.max
      : niceCeil(Math.max(0, ...values())),
  );

  const css = createMemo(() => buildChartCss(chartId, props.config));
  const hasSelection = () => selectedBar() !== null;

  createEffect(() => {
    live.categories = categories();
    live.handlers = { clickable: radialBar().isClickable };
  });

  const toggleSelection = (name: string) => {
    setSelectedBar((prev) => {
      const next = prev === name ? null : name;
      if (next === null) {
        props.onSelectionChange?.(null);
        return next;
      }
      const index = categories().indexOf(next);
      props.onSelectionChange?.({ dataKey: next, value: values()[index] ?? 0 });
      return next;
    });
  };

  const buildOption = (): EChartsOption => {
    const resolved = live.resolved;
    if (!resolved) return {};

    const ctx: OptionBuildContext = {
      config: props.config,
      categories: categories(),
      values: values(),
      radialBar: radialBar(),
      variant: props.variant,
      innerRadius: props.innerRadius,
      outerRadius: props.outerRadius,
      angleMax: angleMax(),
      selectedBar: selectedBar(),
      hasSelection: hasSelection(),
      tooltipSlot: tooltipSlot(),
      isLoading: props.isLoading,
      loadingData,
      resolved,
    };

    if (props.isLoading) return buildLoadingOption(ctx);

    return {
      animation: false,
      polar: buildPolar(ctx),
      angleAxis: buildAngleAxis(ctx),
      radiusAxis: buildRadiusAxis(ctx),
      tooltip: buildTooltipOption(ctx),
      series: buildBarSeries(ctx),
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
          if (!live.handlers.clickable) return;
          const p = params as {
            seriesId?: string;
            dataIndex?: number;
            componentType?: string;
          };
          // Only the main ring series is clickable; track and skeleton are silent.
          if (p.componentType !== "series" || p.seriesId !== MAIN_SERIES_ID) return;
          if (typeof p.dataIndex !== "number") return;
          const name = live.categories[p.dataIndex];
          if (name != null) toggleSelection(name);
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
    const names = categories();
    const isLoading = props.isLoading;
    const reduce = reducedMotion();
    const options = props.chartOptions;
    void collected();
    void props.data;
    void selectedBar();
    void props.variant;
    void angleMax();

    live.resolved = resolveColors(containerRef, config, names);

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
    push(shouldReveal && !reduce);

    live.repush = () => {
      live.resolved = resolveColors(containerRef, config, names);
      push(false);
    };
  });

  // ── Default tooltip at `defaultIndex`, with no hover ────────────────────────
  createEffect(() => {
    chartEpoch();
    const chart = chartInstance;
    const slot = tooltipSlot();
    const index = slot.defaultIndex;
    void props.data.length;
    if (!chart || props.isLoading || !slot.present || index == null) return;

    const timer = setTimeout(() => {
      // Series index 0 is the main ring series — buildBarSeries puts it first
      // precisely so this stays stable whether or not a track is drawn.
      chart.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: index });
    }, 300);
    onCleanup(() => clearTimeout(timer));
  });

  // ── Loading shimmer — a clip window swept diagonally across the rings ───────
  createEffect(() => {
    chartEpoch();
    const chart = chartInstance;
    if (!chart || !props.isLoading) return;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const phase = ((((now - start) / LOADING_ANIMATION_DURATION) % 1) + 1) % 1;
      const foreground = live.resolved?.tokens.foreground ?? "rgba(120, 120, 120, 1)";
      const w = chart.getWidth();
      const h = chart.getHeight();
      if (!w || !h) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const maxT = (w + h) / (2 * w);
      const center = phase * (maxT + 2 * 0.2) - 0.2;
      // ABSOLUTE pixel coordinates: the rings all share one sweep, so the window
      // has to sit at the same place on the canvas for every one of them.
      const clip = new echarts.graphic.LinearGradient(
        0,
        0,
        w,
        w,
        shimmerWindowStops(center, foreground, LOADING_SHIMMER_MAX_OPACITY),
        true,
      );
      chart.setOption(
        { series: [{ id: LOADING_SERIES_ID, itemStyle: { color: clip } }] },
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

      <Show when={props.backgroundVariant}>
        {(variant) => <BackgroundLayer variant={variant()} baseId={baseId} />}
      </Show>

      <div class="relative min-h-0 w-full flex-1">
        <div ref={mountRef} class="h-full min-h-0 w-full" />
      </div>

      <Show when={legendSlot().present && !props.isLoading}>
        <LegendOverlay
          seriesKeys={categories()}
          config={props.config}
          variant={legendSlot().variant}
          align={legendSlot().align}
          verticalAlign={legendSlot().verticalAlign}
          selectedKey={selectedBar()}
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
export const EChartsRadialChart = Object.assign(EChartsRadialChartRoot, {
  RadialBar,
  Tooltip,
  Legend,
});
