/**
 * Apache ECharts line chart for Solid, exposing a compound-as-config API so its
 * JSX reads identically to the EvilCharts original.
 *
 * The root owns the data, config, selection state, loading skeleton, intro
 * reveal, and optional zoom brush; every visual part — `<Line>`, `<XAxis>`,
 * `<YAxis>`, `<Grid>`, `<Tooltip>`, `<Legend>`, `<Brush>` — is a declarative
 * child that renders nothing.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-line-chart.tsx` (MIT).
 *
 * ─── React → Solid notes ───────────────────────────────────────────────────
 * • Props are NEVER destructured; defaults come from mergeProps. Destructuring
 *   would snapshot values and break reactivity.
 * • The init effect uses `on(() => props.renderer, …)` so it re-runs ONLY on a
 *   renderer switch. A bare createEffect would re-init on every tracked read.
 * • `chartEpoch` bumps after each init so the sync effect re-pushes against the
 *   new instance. React got this free from the [renderer] dep array.
 * • `motion/react` has no Solid equivalent; the loading badge uses
 *   tw-animate-css classes instead.
 * • The whole LiveState object is plain (not a signal) — same reasoning as
 *   upstream's useRef: none of it is render output.
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
  buildBrushOption,
  buildChartLayout,
  buildLineSeries,
  buildLoadingOption,
  buildMainAxes,
  buildTooltipOption,
  getLoadingData,
  shimmerWindowStops,
  sliceFrom,
  sliceToNull,
  type EChartsOption,
  type OptionBuildContext,
} from "./options";
import {
  BUFFER_PREFIX,
  GLOW_LAYERS,
  LOADING_ANIMATION_DURATION,
  LOADING_DEFAULT_POINTS,
  LOADING_STROKE_OPACITY,
  REVEAL_DURATION,
  REVEAL_PREFIX,
  type EChartsLineChartProps,
} from "./types";

type EChartsInstance = ReturnType<typeof echarts.init>;

/**
 * Everything the ECharts event handlers, rAF loops, and theme/resize repushes
 * read or write outside the reactive graph, grouped in one object so the whole
 * imperative surface is visible at a glance. None of it is render output, which
 * is exactly why it is not a signal.
 */
type LiveState = {
  resolved: ResolvedColors | null;
  hoveredKey: string | null;
  hasRevealed: boolean;
  revealEndsAt: number;
  loadingRows: number[] | null;
  categories: string[];
  dataLength: number;
  brushRange: BrushRange;
  brushGeom: BrushGeometry | null;
  brushOverlay: BrushOverlayElements | null;
  brushHover: { inside: boolean; left: boolean; right: boolean };
  /**
   * seriesIndex → clickable key for the last build, `undefined` for internal
   * series. A line-body click reports only a seriesIndex, and buffer lines add a
   * second series per key — so the index no longer equals the key's position.
   */
  seriesKeyByIndex: (string | undefined)[];
  /**
   * key → its silent companion series ids (glow overlays, buffer tail, reveal
   * base). Under enableHoverHighlight the root highlights/downplays these with
   * the hovered parent, so focus:"series" can't strand a line's own glow.
   */
  companionIdsByKey: Map<string, string[]>;
  revealIndex: number | null;
  revealValues: Record<string, unknown[]>;
  handlers: {
    onBrushChange?: (range: { startIndex: number; endIndex: number }) => void;
    onSelectionChange?: (key: string | null) => void;
    clickableKeys: Set<string>;
    selectedDataKey: string | null;
    brushFormatLabel?: (value: string, index: number) => string;
    seriesKeys: string[];
    enableHoverHighlight: boolean;
    enableHoverReveal: boolean;
  };
  /** Update-style re-push for paths that bypass the reactive graph. */
  repush: () => void;
};

/** Tracks `prefers-reduced-motion`, the Solid stand-in for useReducedMotion. */
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

function EChartsLineChartRoot<TData extends Record<string, unknown>>(
  rawProps: EChartsLineChartProps<TData>,
): JSX.Element {
  const props = mergeProps(
    {
      renderer: DEFAULT_ECHARTS_RENDERER,
      curveType: "linear" as const,
      animation: true,
      animationType: "left-to-right" as const,
      enableHoverHighlight: false,
      enableHoverReveal: false,
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
    hoveredKey: null,
    hasRevealed: false,
    revealEndsAt: 0,
    loadingRows: null,
    categories: [],
    dataLength: 0,
    brushRange: { start: 0, end: 100 },
    brushGeom: null,
    brushOverlay: null,
    brushHover: { inside: false, left: false, right: false },
    seriesKeyByIndex: [],
    companionIdsByKey: new Map(),
    revealIndex: null,
    revealValues: {},
    handlers: {
      onBrushChange: undefined,
      onSelectionChange: undefined,
      clickableKeys: new Set<string>(),
      selectedDataKey: props.defaultSelectedDataKey,
      brushFormatLabel: undefined,
      seriesKeys: [],
      enableHoverHighlight: props.enableHoverHighlight,
      enableHoverReveal: props.enableHoverReveal,
    },
    repush: () => {},
  };

  /** Skeleton rows roll lazily on first use, so Math.random() isn't re-rolled. */
  const loadingData = () => (live.loadingRows ??= getLoadingData(props.loadingPoints));

  const reducedMotion = createReducedMotion();

  const [selectedDataKey, setSelectedDataKey] = createSignal<string | null>(
    props.defaultSelectedDataKey,
  );
  /**
   * Hover-highlight mirrors into the legend (this signal) and the tooltip
   * (live.hoveredKey — its formatter runs on every hover, and pushing an option
   * to sync it would reset ECharts' native blur state mid-hover).
   */
  const [hoveredDataKey, setHoveredDataKey] = createSignal<string | null>(null);
  /** Bumped after each init so the sync effect re-pushes against the new instance. */
  const [chartEpoch, setChartEpoch] = createSignal(0);

  // ── Declarative config, collected from children ─────────────────────────────
  const resolvedChildren = children(() => props.children);
  const collected = createMemo(() => collectConfig(resolvedChildren()));

  const lines = () => collected().lines;
  const xAxisSlot = () => collected().xAxis;
  const yAxisSlot = () => collected().yAxis;
  const showGrid = () => collected().showGrid;
  const tooltipSlot = () => collected().tooltip;
  const legendSlot = () => collected().legend;
  const brushSlot = () => collected().brush;

  const showBrush = () => brushSlot().present;
  const brushHeight = () => brushSlot().height ?? 56;

  const seriesKeys = createMemo(() => lines().map((line) => line.dataKey));

  /** <XAxis dataKey> → root xDataKey → first data column no <Line> claims. */
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

  /** The intro draw-in follows the first line's setting. */
  const effectiveAnimation = () => lines()[0]?.animationType ?? props.animationType;

  const css = createMemo(() => buildChartCss(chartId, props.config));

  const hasSelection = () => selectedDataKey() !== null;

  const clickableKeys = createMemo(
    () => new Set(lines().filter((line) => line.isClickable).map((l) => l.dataKey)),
  );

  // Keep the imperative handlers' snapshot fresh. In React this was a plain
  // assignment in the render body; here it needs an effect to re-run.
  createEffect(() => {
    live.handlers = {
      onBrushChange: brushSlot().onChange,
      onSelectionChange: props.onSelectionChange,
      clickableKeys: clickableKeys(),
      selectedDataKey: selectedDataKey(),
      brushFormatLabel: brushSlot().formatLabel,
      seriesKeys: seriesKeys(),
      enableHoverHighlight: props.enableHoverHighlight,
      enableHoverReveal: props.enableHoverReveal,
    };
    live.dataLength = props.data.length;
  });

  const toggleSelection = (key: string) => {
    // A new click selection takes over the canvas dim, so any live hover
    // highlight is torn down now — the mouseover guard then keeps it from
    // re-arming while the selection stands.
    if (live.hoveredKey !== null) {
      const companions = chartInstance
        ? live.companionIdsByKey.get(live.hoveredKey)
        : undefined;
      if (chartInstance && companions) {
        for (const seriesId of companions) {
          chartInstance.dispatchAction({ type: "downplay", seriesId });
        }
      }
      live.hoveredKey = null;
      setHoveredDataKey(null);
    }
    setSelectedDataKey((prev) => {
      const next = prev === key ? null : key;
      props.onSelectionChange?.(next);
      return next;
    });
  };

  /**
   * Reposition the brush overlays from the live state — safe to call from drag
   * events, hover tracking, and pushes alike, since it never touches setOption.
   */
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

  /**
   * Thin orchestrator over the pure builders: snapshot the imperative surface
   * into an OptionBuildContext, then assemble.
   */
  const buildOption = (): EChartsOption => {
    const resolved = live.resolved;
    if (!resolved) return {};

    const categories = props.data.map((row) => String(row[xCategoryKey()]));
    live.categories = categories;

    const revealSink: Record<string, unknown[]> = {};

    const ctx: OptionBuildContext = {
      data: props.data,
      config: props.config,
      lines: lines(),
      curveType: props.curveType,
      selectedDataKey: selectedDataKey(),
      hasSelection: hasSelection(),
      showGrid: showGrid(),
      xAxisSlot: xAxisSlot(),
      yAxisSlot: yAxisSlot(),
      tooltipSlot: tooltipSlot(),
      legendSlot: legendSlot(),
      isLoading: props.isLoading,
      loadingData,
      showBrush: showBrush(),
      brushHeight: brushHeight(),
      enableHoverHighlight: props.enableHoverHighlight,
      enableHoverReveal: props.enableHoverReveal,
      revealIndex: live.revealIndex,
      revealSink,
      resolved,
      rendererSize: {
        width: chartInstance?.getWidth() ?? mountRef?.clientWidth ?? 0,
        height: chartInstance?.getHeight() ?? mountRef?.clientHeight ?? 0,
      },
      categories,
      brushRange: live.brushRange,
      getHoveredKey: () => live.hoveredKey,
    };

    const { grid, brushBottom } = buildChartLayout(ctx);
    live.brushGeom = showBrush() ? { bottom: brushBottom, height: brushHeight() } : null;

    const { xAxis, yAxis } = buildMainAxes(ctx);

    if (props.isLoading) return buildLoadingOption(ctx, { grid, xAxis, yAxis });

    const brush = showBrush() ? buildBrushOption(ctx, brushBottom) : null;

    const series = [...buildLineSeries(ctx), ...(brush?.miniSeries ?? [])];
    if (props.enableHoverReveal) live.revealValues = revealSink;

    // Record the exact series order so a line-body click (which reports only a
    // seriesIndex) can recover its key — buffer/reveal/mini series break the
    // "index === key position" shortcut.
    live.seriesKeyByIndex = series.map((s) => {
      const id = String(s.id ?? "");
      return id && !id.startsWith("__") ? id : undefined;
    });

    const companionIdsByKey = new Map<string, string[]>();
    for (const line of lines()) {
      const ids: string[] = [];
      if (line.glowing) {
        for (let i = 0; i < GLOW_LAYERS.length; i++) {
          ids.push(`__glow-${i}-${line.dataKey}`);
        }
      }
      if (line.enableBufferLine && props.data.length >= 2) {
        ids.push(`${BUFFER_PREFIX}${line.dataKey}`);
      }
      if (props.enableHoverReveal) ids.push(`${REVEAL_PREFIX}${line.dataKey}`);
      if (ids.length) companionIdsByKey.set(line.dataKey, ids);
    }
    live.companionIdsByKey = companionIdsByKey;

    return {
      animation: false,
      grid: brush ? [grid, brush.miniGrid] : grid,
      xAxis: brush ? [xAxis, brush.miniXAxis] : xAxis,
      yAxis: brush ? [yAxis, brush.miniYAxis] : yAxis,
      tooltip: buildTooltipOption(ctx),
      dataZoom: brush?.dataZoom,
      series,
    };
  };

  // ── Init + resize + theme observer, per renderer instance ───────────────────
  // `on(…)` is load-bearing: a bare createEffect would re-init the chart on
  // every tracked read inside it.
  createEffect(
    on(
      () => props.renderer,
      (renderer) => {
        if (!mountRef || !containerRef) return;

        // Pointer state belongs to the renderer instance. A renderer switch
        // disposes that surface without emitting mouseout/globalout, so do not
        // carry a hover, reveal slice, or brush-hover into the replacement.
        // Keep brushRange: the zoom window should survive the switch.
        live.hoveredKey = null;
        live.revealIndex = null;
        live.brushHover = { inside: false, left: false, right: false };
        setHoveredDataKey(null);

        const chart = echarts.init(mountRef, null, { renderer });
        chartInstance = chart;

        const resizeObserver = new ResizeObserver(() => {
          // Observers always fire once right after observe(). Repushing on that
          // no-op fire would land one frame into the intro and stomp the line's
          // reveal clip — only react when the renderer size actually changed.
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

        // Light/dark flips change no reactive state — re-resolve and push directly.
        const themeObserver = new MutationObserver(() => live.repush());
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class"],
        });

        chart.on("click", (params) => {
          const { clickableKeys: clickable } = live.handlers;
          const p = params as { seriesId?: string; seriesIndex?: number };
          // Symbol clicks carry seriesId; line clicks (triggerEvent) only carry
          // seriesIndex — recover the key from the last build's index map.
          const id =
            p.seriesId ??
            (typeof p.seriesIndex === "number"
              ? live.seriesKeyByIndex[p.seriesIndex]
              : undefined);
          if (typeof id === "string" && clickable.has(id)) toggleSelection(id);
        });

        chart.on("mouseover", (params) => {
          const { enableHoverHighlight: hoverOn, enableHoverReveal: revealOn } =
            live.handlers;
          // Reveal owns the hover visual, so native highlight stands down.
          if (!hoverOn || revealOn) return;
          // While a series is click-selected, hover highlighting is disabled —
          // the selection dim owns the canvas.
          if (live.handlers.selectedDataKey !== null) return;
          const p = params as {
            seriesId?: string;
            seriesIndex?: number;
            componentType?: string;
          };
          if (p.componentType !== "series") return;
          const id =
            p.seriesId ??
            (typeof p.seriesIndex === "number"
              ? live.seriesKeyByIndex[p.seriesIndex]
              : undefined);
          if (typeof id !== "string" || id.startsWith("__")) return;
          live.hoveredKey = id;
          setHoveredDataKey(id);
          const companions = live.companionIdsByKey.get(id);
          if (companions) {
            for (const seriesId of companions) {
              chart.dispatchAction({ type: "highlight", seriesId });
            }
          }
        });

        chart.on("mouseout", () => {
          const prev = live.hoveredKey;
          if (prev === null) return;
          live.hoveredKey = null;
          setHoveredDataKey(null);
          const companions = live.companionIdsByKey.get(prev);
          if (companions) {
            for (const seriesId of companions) {
              chart.dispatchAction({ type: "downplay", seriesId });
            }
          }
        });

        // Hover-reveal: colour each line up to the pointer's x-index, mute the
        // rest. Purely TARGETED series updates — never a full option rebuild on
        // mousemove, which would replay transitions and fight the axis pointer.
        const zrReveal = chart.getZr();
        const pushReveal = (idx: number | null) => {
          const keys = live.handlers.seriesKeys;
          const on_ = idx !== null;
          chart.setOption(
            {
              series: keys.flatMap((key) => [
                {
                  id: key,
                  data: on_
                    ? sliceToNull(live.revealValues[key] ?? [], idx)
                    : (live.revealValues[key] ?? []),
                },
                {
                  id: `${REVEAL_PREFIX}${key}`,
                  data: on_
                    ? sliceFrom(live.revealValues[key] ?? [], idx)
                    : (live.revealValues[key] ?? []),
                  lineStyle: { opacity: on_ ? 0.3 : 0 },
                },
              ]),
            },
            // NOT lazy: the highlight dispatched just below re-draws the active
            // dot the setOption wipes, so the option must commit first.
            { silent: true },
          );
          // The per-frame setOption cancels the axis tooltip's transient hover
          // symbol, so the <ActiveDot> never lands at the cursor. Re-assert it.
          for (const key of keys) {
            chart.dispatchAction(
              on_
                ? { type: "highlight", seriesId: key, dataIndex: idx as number }
                : { type: "downplay", seriesId: key },
            );
          }
        };
        const clearReveal = () => {
          if (live.revealIndex === null) return;
          live.revealIndex = null;
          pushReveal(null);
        };
        const applyReveal = (event: { offsetX?: number; offsetY?: number }) => {
          const len = live.dataLength;
          if (len < 1) return;
          const x = event.offsetX ?? -1;
          const y = event.offsetY ?? -1;
          if (!chart.containPixel({ gridIndex: 0 }, [x, y])) {
            clearReveal();
            return;
          }
          const raw = chart.convertFromPixel({ gridIndex: 0 }, [x, y])[0];
          const idx = Math.max(0, Math.min(len - 1, Math.round(raw ?? 0)));
          if (idx === live.revealIndex) return;
          live.revealIndex = idx;
          pushReveal(idx);
        };
        const onZrRevealMove = (event: { offsetX?: number; offsetY?: number }) => {
          if (!live.handlers.enableHoverReveal) return;
          applyReveal(event);
        };
        const onZrRevealOut = () => {
          if (live.handlers.enableHoverReveal) clearReveal();
        };
        zrReveal.on("mousemove", onZrRevealMove);
        zrReveal.on("globalout", onZrRevealOut);

        chart.on("datazoom", () => {
          const option = chart.getOption() as {
            dataZoom?: { start?: number; end?: number }[];
          };
          const zoom = option.dataZoom?.[0];
          if (!zoom) return;

          // Ride the selection — pure zrender updates, so the drag stays 1:1.
          live.brushRange = { start: zoom.start ?? 0, end: zoom.end ?? 100 };
          syncBrushOverlayNow();

          const { onBrushChange: onChange } = live.handlers;
          if (!onChange) return;
          const len = live.dataLength;
          const startIndex = Math.round(((zoom.start ?? 0) / 100) * (len - 1));
          const endIndex = Math.round(((zoom.end ?? 100) / 100) * (len - 1));
          onChange({ startIndex, endIndex });
        });

        // Hover tracking for the overlay: labels show while the pointer is over
        // the brush, and each pill brightens near its edge.
        const zr = chart.getZr();
        const applyHover = (next: {
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
          applyHover({
            inside,
            left: inside && Math.abs(x - selectionLeft) <= 8,
            right: inside && Math.abs(x - selectionRight) <= 8,
          });
        };
        const onZrOut = () => applyHover({ inside: false, left: false, right: false });
        zr.on("mousemove", onZrMove);
        zr.on("globalout", onZrOut);

        setChartEpoch((epoch) => epoch + 1);

        onCleanup(() => {
          zrReveal.off("mousemove", onZrRevealMove);
          zrReveal.off("globalout", onZrRevealOut);
          zr.off("mousemove", onZrMove);
          zr.off("globalout", onZrOut);
          resizeObserver.disconnect();
          themeObserver.disconnect();
          chart.dispose();
          chartInstance = null;
          // The overlay elements died with the zrender instance.
          live.brushOverlay = null;
          live.hasRevealed = false;
        });
      },
    ),
  );

  // ── Sync: resolve colours, build, push ──────────────────────────────────────
  createEffect(() => {
    chartEpoch(); // re-push against a freshly created instance
    const chart = chartInstance;
    if (!chart || !containerRef) return;

    // Track everything a rebuild depends on.
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
    void props.enableHoverHighlight;
    void props.enableHoverReveal;

    // Colours come from the <style> committed just before this effect ran.
    live.resolved = resolveColors(containerRef, config, keys);

    const push = (withEntrance: boolean) => {
      const option = buildOption();
      const merged = options ? { ...option, ...options } : option;
      Object.assign(merged, {
        animation: withEntrance,
        animationDuration: REVEAL_DURATION,
        animationDurationUpdate: 0,
      });
      // chartOptions is an untyped escape hatch — the spread erases the option's
      // shape, so re-assert it. The only cast in the file.
      chart.setOption(merged as EChartsOption, { notMerge: true });
      // Overlays live outside the option — reposition after every push.
      syncBrushOverlayNow();
    };

    // Intro reveal — ECharts' native progressive draw, enabled only for the
    // first real render. Every later push applies instantly, since notMerge
    // would otherwise replay the entrance. A loading cycle re-arms it.
    if (isLoading) live.hasRevealed = false;
    const shouldReveal = !live.hasRevealed && !isLoading;
    if (shouldReveal) live.hasRevealed = true;
    const revealEnabled = animation && shouldReveal && animType !== "none" && !reduce;
    if (revealEnabled) live.revealEndsAt = performance.now() + REVEAL_DURATION;
    push(revealEnabled);

    // Theme flips and resizes re-enter here without touching the reactive graph.
    live.repush = () => {
      live.resolved = resolveColors(containerRef, config, keys);
      push(false);
    };
  });

  // ── Animated dashed stroke — rAF sweeps the dash offset while unselected ────
  createEffect(() => {
    chartEpoch();
    const chart = chartInstance;
    const isLoading = props.isLoading;
    const selected = hasSelection();
    const animatedKeys = lines()
      // A buffer line's body is solid (only its tail dashes), so the sweep skips it.
      .filter((line) => line.strokeVariant === "animated-dashed" && !line.enableBufferLine)
      .map((line) => line.dataKey);

    if (!chart || isLoading || animatedKeys.length === 0 || selected) return;

    let raf = 0;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    const begin = () => {
      const loopStart = performance.now();
      const tick = (now: number) => {
        const offset = -(((now - loopStart) / 1000) % 1) * 6; // 0 → -6 per second
        chart.setOption(
          {
            series: animatedKeys.map((id) => ({
              id,
              lineStyle: { dashOffset: offset },
            })),
          },
          { silent: true, lazyUpdate: true },
        );
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    // Per-frame setOption churn fights the intro draw-in (each update pass
    // recomputes the reveal clip, crawling it to a standstill) — hold the dash
    // sweep until the entrance has finished.
    const delay = Math.max(0, live.revealEndsAt - performance.now());
    if (delay > 0) delayTimer = setTimeout(begin, delay + 50);
    else begin();

    onCleanup(() => {
      if (delayTimer !== undefined) clearTimeout(delayTimer);
      cancelAnimationFrame(raf);
    });
  });

  // ── Loading shimmer — rAF sweeps a bright band, regenerating data off-screen ─
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
      // Wrapped past 1 → the band is off-screen; swap in fresh random data.
      if (phase < lastPhase) live.loadingRows = getLoadingData(points);
      lastPhase = phase;

      // Read tokens per frame, so a theme flip mid-loading retints the shimmer.
      const foreground = live.resolved?.tokens.foreground ?? "rgba(120, 120, 120, 1)";
      const w = chart.getWidth();
      const h = chart.getHeight();
      if (!w || !h) {
        raf = requestAnimationFrame(tick);
        return;
      }
      // Farthest plot corner projected onto the 45° axis — keeps the sweep tight
      // instead of dawdling off-plot at the end of each loop.
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
              data: loadingData(),
              lineStyle: { color: clip(LOADING_STROKE_OPACITY), width: 1 },
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

  // ── Legend overlay position ─────────────────────────────────────────────────
  // Insets match the Recharts legend's breathing room inside the plot frame.
  // Kebab-case keys — Solid applies these via setProperty (see echarts-legend).
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
          {/* motion/react has no Solid port; tw-animate-css covers the same
              entrance, and reduced motion drops it entirely. */}
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

/**
 * Compound API: every part hangs off the root as a static member, so a consumer
 * writes `<EChartsLineChart.Line/>`, `<EChartsLineChart.Tooltip/>`, … from a
 * single import.
 */
export const EChartsLineChart = Object.assign(EChartsLineChartRoot, {
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
