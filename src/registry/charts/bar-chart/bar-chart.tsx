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
import type { BarSeriesOption } from "echarts/charts";
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
import { Bar, Brush, Grid, Legend, Tooltip, XAxis, YAxis, collectConfig } from "./parts";
import {
  buildBarSeries,
  buildBrushOption,
  buildChartLayout,
  buildLoadingOption,
  buildMainAxes,
  buildTooltipOption,
  findMaxColumnIndex,
  getLoadingBarData,
  measureBarWidthPx,
  measureValuePxPerUnit,
  shimmerWindowStops,
  type EChartsOption,
  type OptionBuildContext,
} from "./options";
import {
  BAR_GROW_DURATION,
  BAR_STAGGER,
  DEFAULT_BAR_RADIUS,
  EXPAND_COLLAPSED,
  EXPAND_TAU,
  LOADING_ANIMATION_DURATION,
  LOADING_DEFAULT_BARS,
  LOADING_SHIMMER_MAX_OPACITY,
  type EChartsBarChartProps,
} from "./types";

/**
 * Apache ECharts bar chart for Solid.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-bar-chart.tsx` (MIT). See
 * ../line-chart/line-chart.tsx for the shared React → Solid notes.
 *
 * What is specific to this chart:
 * • a push cycle that MEASURES the laid-out coordinate system and rebuilds
 *   in the same task, so the first paint is already correct
 * • the `expandable` variant's hover rAF, driven from a zrender mousemove and
 *   applied as a series-scoped silent merge
 * • `layout` swapping the category and value axes
 *
 * In Solid, `animateExpand` and `patchStrippedCaps` are plain component-scope
 * functions. Upstream has to assign them into a ref from inside an effect
 * because they close over a `useCallback`'d builder; here `buildOption` simply
 * reads current signal values, so no such dance is needed.
 */

type EChartsInstance = ReturnType<typeof echarts.init>;

type LiveState = {
  resolved: ResolvedColors | null;
  hoveredKey: string | null;
  hasRevealed: boolean;
  /** When the intro grow finishes — corrections hold off until then. */
  revealEndsAt: number;
  loadingRows: number[] | null;
  categories: string[];
  dataLength: number;
  brushRange: BrushRange;
  brushGeom: BrushGeometry | null;
  brushOverlay: BrushOverlayElements | null;
  brushHover: { inside: boolean; left: boolean; right: boolean };
  valuePxPerUnit: number | null;
  barWidthPx: number | null;
  expand: { key: string | null; hovered: number | null; progress: Map<number, number> };
  /** In-flight expand animation frame. */
  expandRaf: number;
  handlers: {
    onBrushChange?: (range: { startIndex: number; endIndex: number }) => void;
    clickableKeys: Set<string>;
    selectedDataKey: string | null;
    brushFormatLabel?: (value: string, index: number) => string;
    seriesKeys: string[];
    isHorizontal: boolean;
    /** Any visible stripped bar → run the post-layout cap correction. */
    hasStripped: boolean;
    /** Any blocks bar → re-push once the bar width is measurable. */
    hasBlocks: boolean;
    /** Stacked with >1 series → the segment gap needs the axis scale. */
    hasStackGap: boolean;
    expandableKey: string | null;
    barCategoryGap?: number;
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

function EChartsBarChartRoot<TData extends Record<string, unknown>>(
  rawProps: EChartsBarChartProps<TData>,
): JSX.Element {
  const props = mergeProps(
    {
      renderer: DEFAULT_ECHARTS_RENDERER,
      stackType: "default" as const,
      layout: "vertical" as const,
      barRadius: DEFAULT_BAR_RADIUS,
      animation: true,
      animationType: "left-to-right" as const,
      defaultSelectedDataKey: null,
      enableMaxValueHighlight: false,
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
    categories: [],
    dataLength: 0,
    brushRange: { start: 0, end: 100 },
    brushGeom: null,
    brushOverlay: null,
    brushHover: { inside: false, left: false, right: false },
    valuePxPerUnit: null,
    barWidthPx: null,
    expand: { key: null, hovered: null, progress: new Map<number, number>() },
    expandRaf: 0,
    handlers: {
      onBrushChange: undefined,
      clickableKeys: new Set<string>(),
      selectedDataKey: props.defaultSelectedDataKey,
      brushFormatLabel: undefined,
      seriesKeys: [],
      isHorizontal: false,
      hasStripped: false,
      hasBlocks: false,
      hasStackGap: false,
      expandableKey: null,
      barCategoryGap: undefined,
    },
    repush: () => {},
  };

  const loadingData = () => (live.loadingRows ??= getLoadingBarData(props.loadingBars));
  const reducedMotion = createReducedMotion();

  const [selectedDataKey, setSelectedDataKey] = createSignal<string | null>(
    props.defaultSelectedDataKey,
  );
  const [hoveredDataKey, setHoveredDataKey] = createSignal<string | null>(null);
  const [chartEpoch, setChartEpoch] = createSignal(0);

  const resolvedChildren = children(() => props.children);
  const collected = createMemo(() => collectConfig(resolvedChildren()));

  const bars = () => collected().bars;
  const xAxisSlot = () => collected().xAxis;
  const yAxisSlot = () => collected().yAxis;
  const showGrid = () => collected().showGrid;
  const tooltipSlot = () => collected().tooltip;
  const legendSlot = () => collected().legend;
  const brushSlot = () => collected().brush;

  const showBrush = () => brushSlot().present;
  const brushHeight = () => brushSlot().height ?? 56;

  const seriesKeys = createMemo(() => bars().map((bar) => bar.dataKey));

  const isHorizontal = () => props.layout === "horizontal";
  const isStacked = () => props.stackType === "stacked" || props.stackType === "percent";
  const isPercent = () => props.stackType === "percent";

  // Which physical axis renders the categories depends on the layout.
  const categorySlot = () => (isHorizontal() ? yAxisSlot() : xAxisSlot());
  const valueSlot = () => (isHorizontal() ? xAxisSlot() : yAxisSlot());

  const categoryKey = createMemo(() => {
    const fromAxis = categorySlot().dataKey;
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

  const effectiveAnimation = () => bars()[0]?.animationType ?? props.animationType;
  const css = createMemo(() => buildChartCss(chartId, props.config));
  const hasSelection = () => selectedDataKey() !== null;

  const clickableKeys = createMemo(
    () => new Set(bars().filter((b) => b.isClickable).map((b) => b.dataKey)),
  );

  const maxHighlightIndex = createMemo(() =>
    props.enableMaxValueHighlight ? findMaxColumnIndex(props.data, seriesKeys()) : null,
  );

  const expandableKey = () =>
    bars().find((bar) => bar.variant === "expandable")?.dataKey ?? null;

  createEffect(() => {
    live.handlers = {
      onBrushChange: brushSlot().onChange,
      clickableKeys: clickableKeys(),
      selectedDataKey: selectedDataKey(),
      brushFormatLabel: brushSlot().formatLabel,
      seriesKeys: seriesKeys(),
      isHorizontal: isHorizontal(),
      hasStripped: !props.isLoading && bars().some((b) => b.variant === "stripped"),
      hasBlocks: bars().some((b) => b.variant === "blocks"),
      hasStackGap: isStacked() && bars().length > 1,
      expandableKey: expandableKey(),
      barCategoryGap: props.barCategoryGap,
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

    const categories = props.data.map((row) => String(row[categoryKey()]));
    live.categories = categories;

    const ctx: OptionBuildContext = {
      data: props.data,
      config: props.config,
      bars: bars(),
      seriesKeys: seriesKeys(),
      animationType: props.animationType,
      barRadius: props.barRadius,
      isHorizontal: isHorizontal(),
      isStacked: isStacked(),
      isPercent: isPercent(),
      selectedDataKey: selectedDataKey(),
      hasSelection: hasSelection(),
      showGrid: showGrid(),
      categorySlot: categorySlot(),
      valueSlot: valueSlot(),
      tooltipSlot: tooltipSlot(),
      legendSlot: legendSlot(),
      isLoading: props.isLoading,
      loadingData,
      showBrush: showBrush(),
      brushHeight: brushHeight(),
      barGap: props.barGap,
      barCategoryGap: props.barCategoryGap,
      resolved,
      categories,
      brushRange: live.brushRange,
      valuePxPerUnit: live.valuePxPerUnit,
      barWidthPx: live.barWidthPx,
      expand: live.expand,
      maxHighlightIndex: maxHighlightIndex(),
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
      series: [...buildBarSeries(ctx), ...(brush?.miniSeries ?? [])],
    };
  };

  /** Series-scoped silent merge of just the series whose ids match. */
  const patchSeries = (keys: Set<string>) => {
    const chart = chartInstance;
    if (!chart || !keys.size) return;
    const option = buildOption();
    const series = Array.isArray(option.series)
      ? option.series
      : option.series
        ? [option.series]
        : [];
    const patch = series.filter(
      (s): s is BarSeriesOption => typeof s?.id === "string" && keys.has(s.id),
    );
    if (patch.length) chart.setOption({ series: patch }, { silent: true, lazyUpdate: true });
  };

  const patchStrippedCaps = () =>
    patchSeries(
      new Set(bars().filter((b) => b.variant === "stripped").map((b) => b.dataKey)),
    );

  /**
   * Eases `live.expand.progress` toward its target and re-merges ONLY the
   * expandable series each frame, so the strip grows out of the bar's middle.
   * Never a full notMerge push, which would fight the hover state it animates.
   */
  const animateExpand = (key: string | null, index: number | null) => {
    const expandKeys = new Set(
      bars().filter((bar) => bar.variant === "expandable").map((bar) => bar.dataKey),
    );
    if (!expandKeys.size) return;

    const next = index != null && key != null ? index : null;
    if (live.expand.hovered === next && (key == null || live.expand.key === key)) return;
    if (key != null) live.expand.key = key;
    live.expand.hovered = next;
    // Seed the newly hovered bar so it has something to ease from.
    if (next != null && !live.expand.progress.has(next)) {
      live.expand.progress.set(next, EXPAND_COLLAPSED);
    }
    if (live.expandRaf) return; // a loop is already running; it picks up the target

    let last = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = Math.min(64, now - last);
      last = now;
      // Exponential approach — every bar eases toward its own target, so the one
      // being left keeps closing while the next one opens.
      const k = 1 - Math.exp(-dt / EXPAND_TAU);
      let moving = false;
      for (const [i, value] of live.expand.progress) {
        const target = i === live.expand.hovered ? 1 : EXPAND_COLLAPSED;
        const eased = value + (target - value) * k;
        if (Math.abs(target - eased) < 0.004) {
          if (target === EXPAND_COLLAPSED) live.expand.progress.delete(i);
          else live.expand.progress.set(i, target);
        } else {
          live.expand.progress.set(i, eased);
          moving = true;
        }
      }
      patchSeries(expandKeys);
      live.expandRaf = moving ? requestAnimationFrame(step) : 0;
    };
    live.expandRaf = requestAnimationFrame(step);
  };

  // ── Init + resize + theme observer, per renderer instance ───────────────────
  createEffect(
    on(
      () => props.renderer,
      (renderer) => {
        if (!mountRef || !containerRef) return;

        live.hoveredKey = null;
        live.brushHover = { inside: false, left: false, right: false };
        live.expand = { key: null, hovered: null, progress: new Map<number, number>() };
        live.valuePxPerUnit = null;
        live.barWidthPx = null;
        setHoveredDataKey(null);

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

        const zr = chart.getZr();

        /**
         * An expandable bar is a hairline at rest, so element hover would catch
         * only a couple of pixels — and hovering the empty space above a bar
         * (where the axis tooltip still responds) would highlight without
         * expanding it. Converting the pointer's x back to a category index
         * makes the whole column the target, matching the tooltip.
         */
        const onExpandMove = (event: { offsetX?: number; offsetY?: number }) => {
          const key = live.handlers.expandableKey;
          if (!key) return;
          const point = [event.offsetX ?? -1, event.offsetY ?? -1];
          if (!chart.containPixel({ gridIndex: 0 }, point)) {
            animateExpand(key, null);
            return;
          }
          // A grid finder returns [xValue, yValue]; on a category axis the x
          // value IS the index.
          const converted = chart.convertFromPixel({ gridIndex: 0 }, point);
          const index = Array.isArray(converted) ? converted[0] : converted;
          animateExpand(key, typeof index === "number" ? Math.round(index) : null);
        };
        const onExpandOut = () => {
          const key = live.handlers.expandableKey;
          if (key) animateExpand(key, null);
        };
        zr.on("mousemove", onExpandMove);
        zr.on("globalout", onExpandOut);

        chart.on("click", (params) => {
          const { clickableKeys: clickable, seriesKeys: keys } = live.handlers;
          const p = params as { seriesId?: string; seriesIndex?: number };
          // Bar clicks carry seriesId; the seriesIndex fallback is safety only —
          // main series come first, so the index maps directly.
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

        /**
         * Every push measures the axis scale and corrects stripped caps before
         * it paints, so this only catches rescales that BYPASS push — a dataZoom
         * drag narrowing the window until the value axis re-ranges. The
         * correction is a SILENT series-only merge, so it can't reset the drag.
         * Held off until the entrance finishes so it never lands mid-grow.
         */
        chart.on("finished", () => {
          const { hasStripped, isHorizontal: horiz } = live.handlers;
          if (!hasStripped || performance.now() < live.revealEndsAt) return;
          const measured = measureValuePxPerUnit(chart, horiz);
          if (measured == null) return;
          if (
            live.valuePxPerUnit != null &&
            Math.abs(measured - live.valuePxPerUnit) < 0.5
          ) {
            return;
          }
          live.valuePxPerUnit = measured;
          patchStrippedCaps();
        });

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
        const onZrBrushMove = (event: { offsetX?: number; offsetY?: number }) => {
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
        const onZrBrushOut = () =>
          applyBrushHover({ inside: false, left: false, right: false });
        zr.on("mousemove", onZrBrushMove);
        zr.on("globalout", onZrBrushOut);

        setChartEpoch((epoch) => epoch + 1);

        onCleanup(() => {
          if (live.expandRaf) {
            cancelAnimationFrame(live.expandRaf);
            live.expandRaf = 0;
          }
          zr.off("mousemove", onExpandMove);
          zr.off("globalout", onExpandOut);
          zr.off("mousemove", onZrBrushMove);
          zr.off("globalout", onZrBrushOut);
          resizeObserver.disconnect();
          themeObserver.disconnect();
          chart.dispose();
          chartInstance = null;
          live.brushOverlay = null;
          live.hasRevealed = false;
          live.expand = { key: null, hovered: null, progress: new Map<number, number>() };
          live.valuePxPerUnit = null;
          live.barWidthPx = null;
        });
      },
    ),
  );

  // ── Sync: resolve colours, measure, build, push ─────────────────────────────
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
    const horiz = isHorizontal();
    const categoryGap = props.barCategoryGap;
    void collected();
    void props.data;
    void selectedDataKey();
    void props.stackType;
    void props.barRadius;
    void maxHighlightIndex();

    live.resolved = resolveColors(containerRef, config, keys);

    const push = (withEntrance: boolean) => {
      // Refresh the value-axis scale before building, so stripped caps get the
      // right per-bar fraction on this same push.
      const measured = measureValuePxPerUnit(chart, horiz);
      if (measured != null) live.valuePxPerUnit = measured;

      const apply = () => {
        const option = buildOption();
        const merged = options ? { ...option, ...options } : option;
        Object.assign(merged, {
          animation: withEntrance,
          animationDuration: BAR_GROW_DURATION,
          animationDurationUpdate: 0,
        });
        chart.setOption(merged as EChartsOption, { notMerge: true });
      };

      apply();

      /**
       * Some things can only be sized once a coordinate system exists, so the
       * first build uses fallbacks: the blocks variant's square segments (bar
       * width), the stacked-segment gap, and the stripped cap (both need the
       * value-axis scale). Measure now and, if anything moved, rebuild
       * IMMEDIATELY — still inside this task, before the browser paints, so the
       * corrected chart is the only thing ever shown. Doing it from the async
       * `finished` handler instead made the bars visibly re-align a frame later.
       */
      let needsRebuild = false;
      if (live.handlers.hasBlocks) {
        const width = measureBarWidthPx(chart, horiz, categoryGap);
        if (
          width != null &&
          (live.barWidthPx == null || Math.abs(width - live.barWidthPx) > 0.5)
        ) {
          live.barWidthPx = width;
          needsRebuild = true;
        }
      }
      if (live.handlers.hasStackGap || live.handlers.hasStripped) {
        const scale = measureValuePxPerUnit(chart, horiz);
        if (scale != null && live.valuePxPerUnit !== scale) {
          live.valuePxPerUnit = scale;
          needsRebuild = true;
        }
      }
      if (needsRebuild) apply();

      // Mark when the entrance settles, so the stripped-cap correction holds off
      // until the grow finishes (0 = nothing animating, correct immediately).
      const maxStagger = props.data.length > 1 ? (props.data.length - 1) * BAR_STAGGER : 0;
      live.revealEndsAt = withEntrance
        ? performance.now() + BAR_GROW_DURATION + maxStagger
        : 0;
      syncBrushOverlayNow();
    };

    if (isLoading) live.hasRevealed = false;
    const shouldReveal = !live.hasRevealed && !isLoading;
    if (shouldReveal) live.hasRevealed = true;
    const revealEnabled = animation && shouldReveal && animType !== "none" && !reduce;
    push(revealEnabled);

    live.repush = () => {
      live.resolved = resolveColors(containerRef, config, keys);
      push(false);
    };
  });

  // ── Default tooltip — show it at `defaultIndex` with no hover ───────────────
  // Recharts' `defaultIndex` keeps a tooltip open on load; ECharts has no static
  // equivalent, so dispatch showTip once the layout has settled.
  createEffect(() => {
    chartEpoch();
    const chart = chartInstance;
    const slot = tooltipSlot();
    const index = slot.defaultIndex;
    void props.data.length;
    void seriesKeys().length;
    if (!chart || props.isLoading || !slot.present || index == null) return;

    const timer = setTimeout(() => {
      chart.dispatchAction({ type: "showTip", seriesIndex: 0, dataIndex: index });
    }, 300);
    onCleanup(() => clearTimeout(timer));
  });

  // ── Loading shimmer ─────────────────────────────────────────────────────────
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
      if (phase < lastPhase) live.loadingRows = getLoadingBarData(count);
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
      const clip = new echarts.graphic.LinearGradient(
        0,
        0,
        w,
        w,
        shimmerWindowStops(center, foreground, LOADING_SHIMMER_MAX_OPACITY),
        true,
      );
      chart.setOption(
        {
          series: [{ id: "__loading", data: loadingData(), itemStyle: { color: clip } }],
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
export const EChartsBarChart = Object.assign(EChartsBarChartRoot, {
  Bar,
  XAxis,
  YAxis,
  Grid,
  Tooltip,
  Legend,
  Brush,
});
