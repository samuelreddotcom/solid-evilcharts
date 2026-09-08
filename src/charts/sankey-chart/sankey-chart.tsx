/**
 * Apache ECharts sankey chart for Solid.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-sankey-chart.tsx` (MIT).
 * See ../line-chart/line-chart.tsx for the shared React → Solid notes.
 *
 * The structural outlier: no axes, no polar system, no legend, and a data shape
 * of its own. Its entrance is also unlike every other chart's — a per-column
 * cascade driven by a rAF that re-pushes the full option each frame, because the
 * reveal is expressed as a windowed ALPHA on each element's existing paint
 * rather than as a layout change.
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

import { buildChartCss, resolveColors, type ResolvedColors } from "../../lib/chart-tokens";
import { DEFAULT_ECHARTS_RENDERER } from "../../lib/echarts-paint";
import {
  buildInsidePlateSeries,
  buildLoadingOption,
  buildSankeySeries,
  buildTooltipOption,
  computeNodeDepths,
  computeNodeValues,
  introDuration,
  shimmerWindowStops,
  type EChartsOption,
  type OptionBuildContext,
} from "./options";
import { Link, Node, NodeLabel, Tooltip, collectConfig } from "./parts";
import {
  DEFAULT_ITERATIONS,
  DEFAULT_LINK_CURVATURE,
  DEFAULT_NODE_PADDING,
  DEFAULT_NODE_WIDTH,
  LOADING_ANIMATION_DURATION,
  LOADING_LINK_FLOOR,
  LOADING_LINK_PEAK,
  LOADING_NODE_FLOOR,
  LOADING_NODE_PEAK,
  type EChartsSankeyChartProps,
  type IntroState,
} from "./types";

type EChartsInstance = ReturnType<typeof echarts.init>;

type LiveState = {
  resolved: ResolvedColors | null;
  hasRevealed: boolean;
  /** Current cascade frame, read by every build while it runs. */
  intro: IntroState | null;
  handlers: {
    onSelectionChange?: (selection: { dataKey: string; value: number } | null) => void;
    isNodeClickable: boolean;
    nodeValues: Record<string, number>;
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

function EChartsSankeyChartRoot(rawProps: EChartsSankeyChartProps): JSX.Element {
  const props = mergeProps(
    {
      renderer: DEFAULT_ECHARTS_RENDERER,
      nodeWidth: DEFAULT_NODE_WIDTH,
      nodePadding: DEFAULT_NODE_PADDING,
      linkCurvature: DEFAULT_LINK_CURVATURE,
      iterations: DEFAULT_ITERATIONS,
      align: "justify" as const,
      defaultSelectedNode: null,
      isLoading: false,
      animation: true,
      animationType: "default" as const,
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
    intro: null,
    handlers: {
      onSelectionChange: undefined,
      isNodeClickable: false,
      nodeValues: {},
    },
    repush: () => {},
  };

  const reducedMotion = createReducedMotion();

  const [selectedNode, setSelectedNode] = createSignal<string | null>(
    props.defaultSelectedNode,
  );
  const [chartEpoch, setChartEpoch] = createSignal(0);

  const resolvedChildren = children(() => props.children);
  const collected = createMemo(() => collectConfig(resolvedChildren()));

  const nodeConfig = () => collected().node;
  const nodeLabel = () => collected().nodeLabel;
  const linkConfig = () => collected().link;
  const tooltipSlot = () => collected().tooltip;

  /** Node NAMES are the config keys — same convention as pie sectors. */
  const nodeNames = createMemo(() => props.data.nodes.map((node) => node.name));
  const nodeValues = createMemo(() => computeNodeValues(props.data));

  const css = createMemo(() => buildChartCss(chartId, props.config));

  createEffect(() => {
    live.handlers = {
      onSelectionChange: props.onSelectionChange,
      isNodeClickable: nodeConfig().isClickable,
      nodeValues: nodeValues(),
    };
  });

  const toggleSelection = (name: string) => {
    setSelectedNode((prev) => {
      const next = prev === name ? null : name;
      props.onSelectionChange?.(
        next === null ? null : { dataKey: next, value: nodeValues()[next] ?? 0 },
      );
      return next;
    });
  };

  const buildOption = (): EChartsOption => {
    const resolved = live.resolved;
    if (!resolved) return {};

    const label = nodeLabel();
    const ctx: OptionBuildContext = {
      data: props.data,
      config: props.config,
      nodeConfig: nodeConfig(),
      nodeLabel: label,
      linkConfig: linkConfig(),
      tooltipSlot: tooltipSlot(),
      selectedNode: selectedNode(),
      nodeWidth: props.nodeWidth,
      nodePadding: props.nodePadding,
      linkCurvature: props.linkCurvature,
      iterations: props.iterations,
      align: props.align,
      isLoading: props.isLoading,
      resolved,
      nodeValues: nodeValues(),
      outsideLabels: label?.position === "outside",
      intro: live.intro,
    };

    if (props.isLoading) return buildLoadingOption(ctx);

    const plate = buildInsidePlateSeries(ctx);
    return {
      animation: false,
      tooltip: buildTooltipOption(ctx),
      // The plate rides UNDER the real series; both must be present in the same
      // push so their layouts land pixel-exact.
      series: plate ? [plate, buildSankeySeries(ctx)] : [buildSankeySeries(ctx)],
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
          if (!live.handlers.isNodeClickable) return;
          const p = params as { dataType?: string; name?: string };
          // Links are clickable targets too, but only nodes drive selection.
          if (p.dataType !== "node") return;
          if (typeof p.name === "string") toggleSelection(p.name);
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

  // ── Sync: resolve colours, build, push — and drive the intro cascade ────────
  createEffect(() => {
    chartEpoch();
    const chart = chartInstance;
    if (!chart || !containerRef) return;

    const config = props.config;
    const names = nodeNames();
    const data = props.data;
    const isLoading = props.isLoading;
    const animation = props.animation;
    const animationType = props.animationType;
    const reduce = reducedMotion();
    const options = props.chartOptions;
    void collected();
    void selectedNode();

    live.resolved = resolveColors(containerRef, config, names);

    const push = (silent: boolean) => {
      const option = buildOption();
      const merged = options ? { ...option, ...options } : option;
      Object.assign(merged, { animation: false });
      // Mid-cascade every frame is a silent push: ECharts' own transitions would
      // fight a reveal that is already expressed frame-by-frame in the paints.
      chart.setOption(merged as EChartsOption, { notMerge: true, silent });
    };

    if (isLoading) live.hasRevealed = false;
    const shouldReveal = !live.hasRevealed && !isLoading;
    if (shouldReveal) live.hasRevealed = true;
    const revealEnabled =
      animation && shouldReveal && animationType !== "none" && !reduce;

    let raf = 0;
    if (revealEnabled) {
      const depths = computeNodeDepths(data);
      const duration = introDuration(depths);
      live.intro = { elapsed: 0, depths };
      push(false);

      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const done = elapsed >= duration;
        live.intro = done ? null : { elapsed, depths };
        push(true);
        if (!done) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } else {
      live.intro = null;
      push(false);
    }

    // A theme flip mid-cascade carries the CURRENT frame, so it retints the
    // entrance rather than interrupting it.
    live.repush = () => {
      live.resolved = resolveColors(containerRef, config, names);
      push(false);
    };

    // Anything that re-runs this effect ends an in-flight cascade — the next
    // push draws the finished diagram.
    onCleanup(() => {
      cancelAnimationFrame(raf);
      live.intro = null;
    });
  });

  // ── Loading shimmer ─────────────────────────────────────────────────────────
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
      if (!w) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const center = phase * (1 + 2 * 0.22) - 0.22;
      const sweep = (floor: number, peak: number) =>
        new echarts.graphic.LinearGradient(
          0,
          0,
          1,
          0,
          shimmerWindowStops(center, foreground, floor, peak),
        );
      chart.setOption(
        {
          series: [
            {
              id: "__loading",
              // Nodes and links get their own floor/peak: a link band is
              // translucent by nature, so matching the node's alpha would make
              // the bands read as solid as the nodes.
              itemStyle: { color: sweep(LOADING_NODE_FLOOR, LOADING_NODE_PEAK) },
              lineStyle: {
                color: sweep(LOADING_LINK_FLOOR, LOADING_LINK_PEAK),
                curveness: DEFAULT_LINK_CURVATURE,
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
export const EChartsSankeyChart = Object.assign(EChartsSankeyChartRoot, {
  Node,
  NodeLabel,
  Link,
  Tooltip,
});
