/**
 * Apache ECharts area chart for Solid.
 *
 * Ported from EvilCharts `src/registry/charts/echarts-area-chart.tsx` (MIT).
 * Structurally the line chart's twin; see ../line-chart/line-chart.tsx for the
 * shared React → Solid notes (`on()` on the init effect, `chartEpoch`,
 * mergeProps instead of destructuring, kebab-case styles).
 *
 * What differs here:
 * • stacking (`stackType`), including the mirror stacks that keep buffer /
 *   reveal / mini layers from doubling the real stack's height
 * • a controlled `selectedDataKey` prop
 * • hover-highlight is POINTER-driven, not series-mouseover-driven — see below
 * • no glow overlay
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
  Area,
  Brush,
  Dot,
  Grid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
  collectConfig,
} from "./parts";
import {
  buildAreaSeries,
  buildBrushOption,
  buildChartLayout,
  buildLoadingOption,
  buildMainAxes,
  buildTooltipOption,
  computePlottedTops,
  getLoadingData,
  resolveAreaAtPixel,
  shimmerWindowStops,
  sliceFrom,
  sliceToNull,
  type EChartsOption,
  type OptionBuildContext,
} from "./options";
import {
  BUFFERFILL_PREFIX,
  BUFFER_PREFIX,
  LOADING_ANIMATION_DURATION,
  LOADING_DEFAULT_POINTS,
  LOADING_SHIMMER_MAX_OPACITY,
  LOADING_STROKE_OPACITY,
  REVEAL_DURATION,
  REVEAL_PREFIX,
  type EChartsAreaChartProps,
} from "./types";

type EChartsInstance = ReturnType<typeof echarts.init>;

type LiveState = {
  resolved: ResolvedColors | null;
  hoveredKey: string | null;
  hasRevealed: boolean;
  revealEndsAt: number;
  loadingRows: number[] | null;
  categories: string[];
  dataLength: number;
  /** Per-series plotted top value per index — feeds the pointer hit-test. */
  plottedTops: Record<string, number[]>;
  seriesKeyByIndex: (string | undefined)[];
  companionIdsByKey: Map<string, string[]>;
  revealIndex: number | null;
  revealValues: Record<string, unknown[]>;
  brushRange: BrushRange;
  brushGeom: BrushGeometry | null;
  brushOverlay: BrushOverlayElements | null;
  brushHover: { inside: boolean; left: boolean; right: boolean };
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

function EChartsAreaChartRoot<TData extends Record<string, unknown>>(
  rawProps: EChartsAreaChartProps<TData>,
): JSX.Element {
  const props = mergeProps(
    {
      renderer: DEFAULT_ECHARTS_RENDERER,
      curveType: "linear" as const,
      stackType: "default" as const,
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
    plottedTops: {},
    seriesKeyByIndex: [],
    companionIdsByKey: new Map(),
    revealIndex: null,
    revealValues: {},
    brushRange: { start: 0, end: 100 },
    brushGeom: null,
    brushOverlay: null,
    brushHover: { inside: false, left: false, right: false },
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

  const loadingData = () => (live.loadingRows ??= getLoadingData(props.loadingPoints));
  const reducedMotion = createReducedMotion();

  // Selection is controlled when `selectedDataKey` is provided; otherwise the
  // internal signal (seeded by defaultSelectedDataKey) drives it.
  const [internalSelectedKey, setInternalSelectedKey] = createSignal<string | null>(
    props.defaultSelectedDataKey,
  );
  const selectedDataKey = () =>
    props.selectedDataKey !== undefined ? props.selectedDataKey : internalSelectedKey();

  const [hoveredDataKey, setHoveredDataKey] = createSignal<string | null>(null);
  const [chartEpoch, setChartEpoch] = createSignal(0);

  const resolvedChildren = children(() => props.children);
  const collected = createMemo(() => collectConfig(resolvedChildren()));

  const areas = () => collected().areas;
  const xAxisSlot = () => collected().xAxis;
  const yAxisSlot = () => collected().yAxis;
  const showGrid = () => collected().showGrid;
  const tooltipSlot = () => collected().tooltip;
  const legendSlot = () => collected().legend;
  const brushSlot = () => collected().brush;

  const showBrush = () => brushSlot().present;
  const brushHeight = () => brushSlot().height ?? 56;

  const seriesKeys = createMemo(() => areas().map((area) => area.dataKey));

  const isStacked = () => props.stackType === "stacked" || props.stackType === "expanded";
  const isExpanded = () => props.stackType === "expanded";

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

  const effectiveAnimation = () => areas()[0]?.animationType ?? props.animationType;
  const css = createMemo(() => buildChartCss(chartId, props.config));
  const hasSelection = () => selectedDataKey() !== null;

  const clickableKeys = createMemo(
    () => new Set(areas().filter((a) => a.isClickable).map((a) => a.dataKey)),
  );

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
    if (live.hoveredKey !== null) {
      const companions = chartInstance
        ? live.companionIdsByKey.get(live.hoveredKey)
        : undefined;
      if (chartInstance) {
        chartInstance.dispatchAction({ type: "downplay", seriesId: live.hoveredKey });
        for (const seriesId of companions ?? []) {
          chartInstance.dispatchAction({ type: "downplay", seriesId });
        }
      }
      live.hoveredKey = null;
      setHoveredDataKey(null);
    }
    const next = live.handlers.selectedDataKey === key ? null : key;
    setInternalSelectedKey(next);
    props.onSelectionChange?.(next);
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

    const revealSink: Record<string, unknown[]> = {};

    const ctx: OptionBuildContext = {
      data: props.data,
      config: props.config,
      areas: areas(),
      seriesKeys: seriesKeys(),
      curveType: props.curveType,
      isStacked: isStacked(),
      isExpanded: isExpanded(),
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
    live.plottedTops = computePlottedTops(ctx);

    const { xAxis, yAxis } = buildMainAxes(ctx);

    if (props.isLoading) return buildLoadingOption(ctx, { grid, xAxis, yAxis });

    const brush = showBrush() ? buildBrushOption(ctx, brushBottom) : null;

    const series = [...buildAreaSeries(ctx), ...(brush?.miniSeries ?? [])];
    if (props.enableHoverReveal) live.revealValues = revealSink;

    live.seriesKeyByIndex = series.map((s) => {
      const id = String(s.id ?? "");
      return id && !id.startsWith("__") ? id : undefined;
    });

    const companionIdsByKey = new Map<string, string[]>();
    for (const area of areas()) {
      const ids: string[] = [];
      if (area.enableBufferLine && props.data.length >= 2) {
        ids.push(`${BUFFER_PREFIX}${area.dataKey}`, `${BUFFERFILL_PREFIX}${area.dataKey}`);
      }
      if (props.enableHoverReveal) ids.push(`${REVEAL_PREFIX}${area.dataKey}`);
      if (ids.length) companionIdsByKey.set(area.dataKey, ids);
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
  createEffect(
    on(
      () => props.renderer,
      (renderer) => {
        if (!mountRef || !containerRef) return;

        live.hoveredKey = null;
        live.revealIndex = null;
        live.brushHover = { inside: false, left: false, right: false };
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

        chart.on("click", (params) => {
          const { clickableKeys: clickable, seriesKeys: keys } = live.handlers;
          const p = params as {
            seriesId?: string;
            seriesIndex?: number;
            event?: { offsetX?: number; offsetY?: number };
          };
          let id =
            p.seriesId ??
            (typeof p.seriesIndex === "number"
              ? live.seriesKeyByIndex[p.seriesIndex]
              : undefined);
          // Overlapping polygons: the native hit is the topmost series, not the
          // band the pointer is visually inside — resolve geometrically.
          if (
            typeof p.event?.offsetX === "number" &&
            typeof p.event?.offsetY === "number"
          ) {
            const hit = resolveAreaAtPixel(
              chart,
              live.plottedTops,
              keys,
              p.event.offsetX,
              p.event.offsetY,
            );
            if (hit) id = hit;
          }
          if (typeof id === "string" && clickable.has(id)) toggleSelection(id);
        });

        /**
         * Hover-highlight is POINTER-driven, not series-mouseover-driven.
         * Overlapping polygons would pin the native hover on the topmost series
         * and never re-fire while the pointer moves within it, so a zrender
         * mousemove tracker resolves the visually-hovered band instead.
         */
        const applyHoverKey = (key: string | null) => {
          if (live.hoveredKey === key) return;
          const previous = live.hoveredKey;
          live.hoveredKey = key;
          setHoveredDataKey(key);
          // Dispatch by seriesId — buffer/reveal series shift the numeric
          // indices — and link each key's silent companions so focus:"series"
          // never strands them apart from their parent.
          if (previous) {
            chart.dispatchAction({ type: "downplay", seriesId: previous });
            for (const id of live.companionIdsByKey.get(previous) ?? []) {
              chart.dispatchAction({ type: "downplay", seriesId: id });
            }
          }
          if (key) {
            chart.dispatchAction({ type: "highlight", seriesId: key });
            for (const id of live.companionIdsByKey.get(key) ?? []) {
              chart.dispatchAction({ type: "highlight", seriesId: id });
            }
          }
        };

        const zrHover = chart.getZr();

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
            { silent: true },
          );
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

        const onZrHoverMove = (event: { offsetX?: number; offsetY?: number }) => {
          // Reveal is a standalone hover mode and takes precedence.
          if (live.handlers.enableHoverReveal) {
            applyReveal(event);
            return;
          }
          if (!live.handlers.enableHoverHighlight) return;
          // A click selection owns the canvas dim — hover highlighting stops
          // entirely while one exists and resumes once it clears.
          if (live.handlers.selectedDataKey !== null) return;
          applyHoverKey(
            resolveAreaAtPixel(
              chart,
              live.plottedTops,
              live.handlers.seriesKeys,
              event.offsetX ?? -1,
              event.offsetY ?? -1,
            ),
          );
        };
        const onZrHoverOut = () => {
          if (live.handlers.enableHoverReveal) clearReveal();
          else if (live.handlers.enableHoverHighlight) applyHoverKey(null);
        };
        zrHover.on("mousemove", onZrHoverMove);
        zrHover.on("globalout", onZrHoverOut);

        // The native hover still emphasises whichever element the pointer
        // entered — cancel it whenever it disagrees with the tracker.
        chart.on("mouseover", (params) => {
          const { enableHoverHighlight: hoverOn, enableHoverReveal: revealOn } =
            live.handlers;
          if (!hoverOn || revealOn) return;
          if (live.handlers.selectedDataKey !== null) return;
          const p = params as { seriesIndex?: number; componentType?: string };
          if (p.componentType !== "series" || typeof p.seriesIndex !== "number") return;
          const key = live.seriesKeyByIndex[p.seriesIndex];
          if (!key || key.startsWith("__")) return;
          if (key !== live.hoveredKey) {
            chart.dispatchAction({ type: "downplay", seriesIndex: p.seriesIndex });
            if (live.hoveredKey) {
              chart.dispatchAction({ type: "highlight", seriesId: live.hoveredKey });
            }
          }
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
        zrHover.on("mousemove", onZrBrushMove);
        zrHover.on("globalout", onZrBrushOut);

        setChartEpoch((epoch) => epoch + 1);

        onCleanup(() => {
          zrHover.off("mousemove", onZrHoverMove);
          zrHover.off("globalout", onZrHoverOut);
          zrHover.off("mousemove", onZrBrushMove);
          zrHover.off("globalout", onZrBrushOut);
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
    void props.stackType;
    void props.enableHoverHighlight;
    void props.enableHoverReveal;

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
    const selected = hasSelection();
    const animatedKeys = areas()
      .filter((area) => area.strokeVariant === "animated-dashed" && !area.enableBufferLine)
      .map((area) => area.dataKey);

    if (!chart || isLoading || animatedKeys.length === 0 || selected) return;

    let raf = 0;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    const begin = () => {
      const loopStart = performance.now();
      const tick = (now: number) => {
        const offset = -(((now - loopStart) / 1000) % 1) * 6;
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

    // Per-frame setOption churn fights the intro draw-in — hold until it ends.
    const delay = Math.max(0, live.revealEndsAt - performance.now());
    if (delay > 0) delayTimer = setTimeout(begin, delay + 50);
    else begin();

    onCleanup(() => {
      if (delayTimer !== undefined) clearTimeout(delayTimer);
      cancelAnimationFrame(raf);
    });
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
      // ABSOLUTE pixel coords shared by stroke and fill — bbox-relative coords
      // put the window at different positions for the line vs the area polygon
      // (their bounding boxes differ), which makes the line trail the fill.
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
export const EChartsAreaChart = Object.assign(EChartsAreaChartRoot, {
  Area,
  Dot,
  ActiveDot,
  XAxis,
  YAxis,
  Grid,
  Tooltip,
  Legend,
  Brush,
});
