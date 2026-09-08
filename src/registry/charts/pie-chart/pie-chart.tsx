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
import { BackgroundLayer } from "../../lib/chart-background";
import {
  buildLoadingOption,
  buildPieSeries,
  buildShimmerSectors,
  buildTooltipOption,
  type EChartsOption,
  type OptionBuildContext,
} from "./options";
import { Background, Label, Legend, Pie, Tooltip, collectConfig } from "./parts";
import {
  LOADING_ANIMATION_DURATION,
  REVEAL_DURATION,
  type EChartsPieChartProps,
} from "./types";

/**
 * Apache ECharts pie chart for Solid.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-pie-chart.tsx` (MIT). See
 * ../line-chart/line-chart.tsx for the shared React → Solid notes.
 *
 * The first non-cartesian chart, and much smaller than the cartesian ones: no
 * axes, no grid, no brush, no dataZoom, no resize-driven texture rebakes. What
 * it adds is an SVG background layer behind the transparent canvas, and a
 * shimmer that sweeps ANGULARLY around the ring rather than diagonally across a
 * plot.
 */

type EChartsInstance = ReturnType<typeof echarts.init>;

type LiveState = {
  resolved: ResolvedColors | null;
  hasRevealed: boolean;
  handlers: {
    isClickable: boolean;
    selectedSector: string | null;
    selectSector: (name: string | null) => void;
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

function EChartsPieChartRoot<TData extends Record<string, unknown>>(
  rawProps: EChartsPieChartProps<TData>,
): JSX.Element {
  const props = mergeProps(
    {
      renderer: DEFAULT_ECHARTS_RENDERER,
      animation: true,
      defaultSelectedSector: null,
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
    handlers: {
      isClickable: false,
      selectedSector: props.defaultSelectedSector,
      selectSector: () => {},
    },
    repush: () => {},
  };

  const reducedMotion = createReducedMotion();

  // Controlled when `selectedSector` is provided; otherwise the internal signal.
  const [internalSelected, setInternalSelected] = createSignal<string | null>(
    props.defaultSelectedSector,
  );
  const selectedSector = () =>
    props.selectedSector !== undefined ? props.selectedSector : internalSelected();

  const [chartEpoch, setChartEpoch] = createSignal(0);

  const resolvedChildren = children(() => props.children);
  const collected = createMemo(() => collectConfig(resolvedChildren()));

  const pie = () => collected().pie;
  const tooltipSlot = () => collected().tooltip;
  const legendSlot = () => collected().legend;
  const backgroundSlot = () => collected().background;

  /**
   * Sector NAMES double as the config keys here — unlike the cartesian charts,
   * where a series key is a column. Every colour var is keyed by sector name.
   */
  const sectorNames = createMemo(() =>
    props.data.map((row) => String(row[props.nameKey])),
  );

  const css = createMemo(() => buildChartCss(chartId, props.config));

  const selectSector = (name: string | null) => {
    setInternalSelected(name);
    if (name === null) {
      props.onSelectionChange?.(null);
      return;
    }
    const item = props.data.find((row) => String(row[props.nameKey]) === name);
    props.onSelectionChange?.(
      item ? { dataKey: name, value: Number(item[props.dataKey]) || 0 } : null,
    );
  };

  createEffect(() => {
    live.handlers = {
      isClickable: pie()?.isClickable ?? false,
      selectedSector: selectedSector(),
      selectSector,
    };
  });

  const buildOption = (): EChartsOption => {
    const resolved = live.resolved;
    if (!resolved) return {};

    const ctx: OptionBuildContext = {
      data: props.data,
      config: props.config,
      nameKey: props.nameKey,
      dataKey: props.dataKey,
      pie: pie(),
      selectedSector: selectedSector(),
      tooltipSlot: tooltipSlot(),
      legendSlot: legendSlot(),
      isLoading: props.isLoading,
      resolved,
    };

    if (props.isLoading) return buildLoadingOption(ctx);

    return {
      animation: false,
      tooltip: buildTooltipOption(ctx),
      series: buildPieSeries(ctx),
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
          const { isClickable, selectedSector: selected, selectSector: select } =
            live.handlers;
          if (!isClickable) return;
          const p = params as { name?: string; seriesId?: string };
          // Ignore the loading skeleton's `__`-prefixed series.
          if (String(p.seriesId ?? "").startsWith("__")) return;
          const name = p.name;
          if (typeof name !== "string") return;
          // Clicking the selected sector clears the selection.
          select(selected === name ? null : name);
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
    const names = sectorNames();
    const isLoading = props.isLoading;
    const animation = props.animation;
    const reduce = reducedMotion();
    const options = props.chartOptions;
    void collected();
    void props.data;
    void selectedSector();

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
    push(animation && shouldReveal && !reduce);

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
      chart.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: index });
    }, 300);
    onCleanup(() => clearTimeout(timer));
  });

  // ── Loading shimmer — an ANGULAR sweep around the ring ──────────────────────
  createEffect(() => {
    chartEpoch();
    const chart = chartInstance;
    const isLoading = props.isLoading;
    const slot = pie();
    if (!chart || !isLoading) return;

    const cornerRadius = slot?.cornerRadius ?? 0;
    const paddingAngle = slot?.paddingAngle ?? 0;

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const phase = ((((now - start) / LOADING_ANIMATION_DURATION) % 1) + 1) % 1;
      // Read tokens per frame, so a theme flip mid-loading retints the shimmer.
      const foreground = live.resolved?.tokens.foreground ?? "rgba(120, 120, 120, 1)";
      const background = live.resolved?.tokens.background ?? "rgba(120, 120, 120, 1)";

      chart.setOption(
        {
          series: [
            {
              id: "__loading",
              data: buildShimmerSectors({
                phase,
                foreground,
                background,
                cornerRadius,
                paddingAngle,
              }),
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

      <Show when={backgroundSlot().present}>
        <BackgroundLayer variant={backgroundSlot().variant} baseId={baseId} />
      </Show>

      <div class="relative min-h-0 w-full flex-1">
        <div ref={mountRef} class="h-full min-h-0 w-full" />
      </div>

      <Show when={legendSlot().present && !props.isLoading}>
        <LegendOverlay
          seriesKeys={sectorNames()}
          config={props.config}
          variant={legendSlot().variant}
          align={legendSlot().align}
          verticalAlign={legendSlot().verticalAlign}
          selectedKey={selectedSector()}
          hoveredKey={null}
          isClickable={legendSlot().isClickable}
          onToggle={(key) => selectSector(selectedSector() === key ? null : key)}
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
export const EChartsPieChart = Object.assign(EChartsPieChartRoot, {
  Pie,
  Label,
  Tooltip,
  Legend,
  Background,
});
