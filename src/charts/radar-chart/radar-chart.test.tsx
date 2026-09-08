import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import type { JSX } from "solid-js";
import * as echarts from "echarts/core";

import type { ResolvedColors } from "../../lib/chart-tokens";
import {
  buildLoadingOption,
  buildRadarComponent,
  buildRadarSeries,
  computeIndicatorMax,
  createTooltipFormatter,
  radarCenterY,
  radarFillPaint,
  radarStrokePaint,
  selectionOpacity,
  type OptionBuildContext,
} from "./options";
import { collectConfig } from "./parts";
import { EChartsRadarChart } from "./radar-chart";
import { DEFAULT_FILL_OPACITY, type ChartConfig, type RadarSeriesConfig } from "./types";

beforeAll(() => {
  for (const [prop, value] of [
    ["clientWidth", 600],
    ["clientHeight", 400],
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get: () => value,
    });
  }
});

const TOKENS: ResolvedColors["tokens"] = {
  mutedForeground: "rgba(100, 100, 100, 1)",
  border: "rgba(200, 200, 200, 0.5)",
  foreground: "rgba(0, 0, 0, 1)",
  background: "rgba(255, 255, 255, 1)",
};

const DATA = [
  { month: "January", desktop: 186, mobile: 80 },
  { month: "February", desktop: 305, mobile: 200 },
  { month: "March", desktop: 237, mobile: 120 },
];

const CONFIG: ChartConfig = {
  desktop: { label: "Desktop", colors: { light: ["#047857"], dark: ["#10b981"] } },
  mobile: { label: "Mobile", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
};

function radar(overrides: Partial<RadarSeriesConfig> = {}): RadarSeriesConfig {
  return {
    dataKey: "desktop",
    variant: "filled",
    fillOpacity: DEFAULT_FILL_OPACITY,
    isClickable: false,
    dotVariant: "none",
    activeDotVariant: "none",
    ...overrides,
  };
}

function ctx(overrides: Partial<OptionBuildContext> = {}): OptionBuildContext {
  return {
    data: DATA,
    config: CONFIG,
    radars: [radar()],
    seriesKeys: ["desktop"],
    selectedDataKey: null,
    hasSelection: false,
    gridSlot: { present: false, gridType: "polygon" },
    angleAxisSlot: { present: false },
    radiusAxisSlot: { present: false },
    tooltipSlot: {
      present: false,
      variant: "default",
      roundness: "lg",
      position: "variable",
    },
    legendSlot: {
      present: false,
      variant: "rounded-square",
      align: "center",
      verticalAlign: "bottom",
      isClickable: false,
    },
    isLoading: false,
    loadingData: () => [10, 20, 30, 40, 50, 60],
    loadingPoints: 6,
    resolved: {
      series: { desktop: ["rgba(0, 170, 0, 1)"], mobile: ["rgba(170, 0, 0, 1)"] },
      tokens: TOKENS,
    },
    categories: ["January", "February", "March"],
    indicatorMax: 305,
    ...overrides,
  };
}

const disposers: Array<() => void> = [];
afterEach(() => {
  while (disposers.length) disposers.pop()!();
  document.body.innerHTML = "";
});

function mount(ui: () => JSX.Element): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  disposers.push(render(ui, host));
  return host;
}

describe("selectionOpacity", () => {
  it("never dims a NON-clickable radar, even when a sibling is selected", () => {
    expect(selectionOpacity("mobile", "desktop", false)).toEqual({
      fill: 1,
      stroke: 1,
      dot: 1,
    });
  });

  it("leaves the selected radar alone", () => {
    expect(selectionOpacity("desktop", "desktop", true)).toEqual({
      fill: 1,
      stroke: 1,
      dot: 1,
    });
  });

  it("drops a dimmed fill TWICE as far as its stroke, so the outline still reads", () => {
    const dim = selectionOpacity("mobile", "desktop", true);
    expect(dim).toEqual({ fill: 0.1, stroke: 0.2, dot: 0.2 });
    expect(dim.fill * 2).toBeCloseTo(dim.stroke);
  });
});

describe("computeIndicatorMax", () => {
  it("takes the largest value across EVERY series — one shared radius scale", () => {
    expect(computeIndicatorMax(DATA, ["desktop", "mobile"])).toBe(305);
  });

  it("uses only the requested series", () => {
    expect(computeIndicatorMax(DATA, ["mobile"])).toBe(200);
  });

  it("never returns 0, which would collapse the radius scale", () => {
    expect(computeIndicatorMax([{ a: 0 }], ["a"])).toBe(1);
    expect(computeIndicatorMax([], ["a"])).toBe(1);
  });
});

describe("paints", () => {
  it("runs the stroke gradient diagonally", () => {
    const g = radarStrokePaint(["#a", "#b"]) as echarts.graphic.LinearGradient;
    expect([g.x, g.y, g.x2, g.y2]).toEqual([0, 0, 1, 1]);
  });

  it("returns a plain stroke colour for one slot", () => {
    expect(radarStrokePaint(["rgba(0, 170, 0, 1)"])).toBe("rgba(0, 170, 0, 1)");
  });

  it("fills radially from the centre, bright in the middle and fading to the rim", () => {
    const g = radarFillPaint(["rgba(0, 170, 0, 1)"]);
    expect(g).toBeInstanceOf(echarts.graphic.RadialGradient);
    expect(g.colorStops[0]!.color).toBe("rgba(0, 170, 0, 0.800)");
    expect(g.colorStops[1]!.color).toBe("rgba(0, 170, 0, 0.300)");
  });
});

describe("radarCenterY", () => {
  const slot = (verticalAlign: "top" | "middle" | "bottom", present = true) =>
    ({
      present,
      variant: "rounded-square",
      align: "center",
      verticalAlign,
      isClickable: false,
    }) as const;

  it("centres with no legend", () => {
    expect(radarCenterY(slot("bottom", false))).toBe("50%");
  });

  it("floats the radar away from the legend", () => {
    expect(radarCenterY(slot("bottom"))).toBe("46%");
    expect(radarCenterY(slot("top"))).toBe("54%");
  });
});

describe("buildRadarComponent", () => {
  it("starts the first category at the TOP, matching Recharts", () => {
    expect(buildRadarComponent(ctx()).startAngle).toBe(90);
  });

  it("gives every indicator the SAME max — one shared radius scale", () => {
    const component = buildRadarComponent(ctx());
    expect(component.indicator).toEqual([
      { name: "January", max: 305 },
      { name: "February", max: 305 },
      { name: "March", max: 305 },
    ]);
  });

  it("maps <PolarGrid> onto BOTH the spokes and the rings", () => {
    // The ECharts field names don't match the component names: axisLine is the
    // spokes, splitLine is the rings, and one marker drives both.
    const off = buildRadarComponent(ctx());
    expect(off.axisLine?.show).toBe(false);
    expect(off.splitLine?.show).toBe(false);

    const on = buildRadarComponent(ctx({ gridSlot: { present: true, gridType: "polygon" } }));
    expect(on.axisLine?.show).toBe(true);
    expect(on.splitLine?.show).toBe(true);
  });

  it("maps <PolarAngleAxis> onto the PERIMETER labels (axisName)", () => {
    expect(buildRadarComponent(ctx()).axisName?.show).toBe(false);
    expect(
      buildRadarComponent(ctx({ angleAxisSlot: { present: true } })).axisName?.show,
    ).toBe(true);
  });

  it("maps <PolarRadiusAxis> onto the RADIAL scale (axisLabel)", () => {
    expect(buildRadarComponent(ctx()).axisLabel?.show).toBe(false);
    expect(
      buildRadarComponent(ctx({ radiusAxisSlot: { present: true } })).axisLabel?.show,
    ).toBe(true);
  });

  it("hides the 0 at the dead centre", () => {
    expect(buildRadarComponent(ctx()).axisLabel?.showMinLabel).toBe(false);
  });

  it("takes its ring shape from gridType", () => {
    expect(
      buildRadarComponent(ctx({ gridSlot: { present: true, gridType: "circle" } })).shape,
    ).toBe("circle");
  });

  it("hides every axis part while loading", () => {
    const loading = buildRadarComponent(
      ctx({
        isLoading: true,
        gridSlot: { present: true, gridType: "polygon" },
        angleAxisSlot: { present: true },
        radiusAxisSlot: { present: true },
      }),
    );
    expect(loading.axisLine?.show).toBe(false);
    expect(loading.splitLine?.show).toBe(false);
    expect(loading.axisName?.show).toBe(false);
    expect(loading.axisLabel?.show).toBe(false);
  });
});

describe("buildRadarSeries", () => {
  it("emits ONE data item per series — a single polygon over every category", () => {
    const series = buildRadarSeries(ctx());
    expect(series[0]!.data).toEqual([{ value: [186, 305, 237] }]);
  });

  it("omits the fill entirely for the lines variant", () => {
    expect(buildRadarSeries(ctx())[0]!.areaStyle).toBeDefined();
    const lines = buildRadarSeries(ctx({ radars: [radar({ variant: "lines" })] }));
    expect(lines[0]!.areaStyle).toBeUndefined();
  });

  it("multiplies the consumer's fillOpacity into the area opacity", () => {
    const series = buildRadarSeries(ctx({ radars: [radar({ fillOpacity: 0.5 })] }));
    expect(series[0]!.areaStyle?.opacity).toBe(0.5);
  });

  it("z-orders the selected radar above and the dimmed ones below", () => {
    const selected = buildRadarSeries(
      ctx({ selectedDataKey: "desktop", hasSelection: true }),
    );
    expect(selected[0]!.z).toBe(3);
    const other = buildRadarSeries(ctx({ selectedDataKey: "mobile", hasSelection: true }));
    expect(other[0]!.z).toBe(1);
  });

  it("puts everything at the TOP z when nothing is selected", () => {
    // Upstream's `isSelected` means "not dimmed", so with no selection it is
    // true for every series and the z expression's `: 2` fallback is dead code.
    // Pinned here so the quirk is visible rather than looking like a bug.
    expect(buildRadarSeries(ctx())[0]!.z).toBe(3);
  });

  it("hides resting dots but keeps the symbol when only an <ActiveDot> is declared", () => {
    const series = buildRadarSeries(
      ctx({ radars: [radar({ activeDotVariant: "border" })] }),
    );
    expect(series[0]!.symbol).toBe("circle");
    expect(series[0]!.itemStyle?.opacity).toBe(0);
  });

  it("draws no symbol at all when neither dot is declared", () => {
    expect(buildRadarSeries(ctx())[0]!.symbol).toBe("none");
  });

  it("disables hover emphasis entirely while a selection owns the canvas", () => {
    // Native emphasis would force a dimmed radar's dot back to full opacity,
    // fighting the selection dim.
    const series = buildRadarSeries(
      ctx({ selectedDataKey: "mobile", hasSelection: true }),
    );
    expect(series[0]!.emphasis).toEqual({ disabled: true });
  });

  it("promotes only the DOT on hover, leaving line and fill at rest", () => {
    const series = buildRadarSeries(ctx({ radars: [radar({ dotVariant: "default" })] }));
    const emphasis = series[0]!.emphasis as {
      itemStyle?: { opacity: number };
      lineStyle?: { opacity: number };
    };
    expect(emphasis.itemStyle?.opacity).toBe(1);
    expect(emphasis.lineStyle?.opacity).toBe(1);
  });
});

describe("loading skeleton", () => {
  it("draws one polygon with its own point count", () => {
    const option = buildLoadingOption(ctx({ isLoading: true }));
    const series = option.series as { id: string; data: { value: number[] }[] }[];
    expect(series).toHaveLength(1);
    expect(series[0]!.id).toBe("__loading");
    expect(series[0]!.data[0]!.value).toHaveLength(6);
  });

  it("starts fully transparent until the first shimmer tick", () => {
    const option = buildLoadingOption(ctx({ isLoading: true }));
    const series = option.series as {
      lineStyle: { color: string };
      areaStyle: { color: string };
    }[];
    expect(series[0]!.lineStyle.color).toBe("rgba(0, 0, 0, 0.000)");
    expect(series[0]!.areaStyle.color).toBe("rgba(0, 0, 0, 0.000)");
  });
});

describe("tooltip formatter", () => {
  it("headers the SERIES and rows the categories — the inverse of an axis tooltip", () => {
    const html = createTooltipFormatter(ctx())({
      seriesId: "desktop",
      value: [186, 305, 237],
    });
    expect(html).toContain("Desktop");
    expect(html).toContain("January");
    expect(html).toContain("February");
    expect(html).toContain("186");
  });

  it("dims the WHOLE shell for a non-selected series, not individual rows", () => {
    const html = createTooltipFormatter(ctx({ selectedDataKey: "mobile" }))({
      seriesId: "desktop",
      value: [186],
    });
    expect(html).toContain("shadow-xl opacity-30");
  });

  it("drops the loading skeleton", () => {
    expect(createTooltipFormatter(ctx())({ seriesId: "__loading", value: [1] })).toBe("");
  });
});

describe("collectConfig", () => {
  it("defaults a <Radar> to a filled variant", () => {
    const collected = collectConfig(
      (<EChartsRadarChart.Radar dataKey="desktop" />) as unknown,
    );
    expect(collected.radars[0]).toMatchObject({
      variant: "filled",
      fillOpacity: DEFAULT_FILL_OPACITY,
      isClickable: false,
      dotVariant: "none",
    });
  });

  it("reads dots out of the non-rendering <Radar>", () => {
    const collected = collectConfig(
      (
        <EChartsRadarChart.Radar dataKey="desktop">
          <EChartsRadarChart.Dot variant="border" />
          <EChartsRadarChart.ActiveDot variant="ping" />
        </EChartsRadarChart.Radar>
      ) as unknown,
    );
    expect(collected.radars[0]!.dotVariant).toBe("border");
    expect(collected.radars[0]!.activeDotVariant).toBe("ping");
  });

  it("turns the three axis markers on by presence", () => {
    const collected = collectConfig(
      (
        <>
          <EChartsRadarChart.PolarGrid gridType="circle" />
          <EChartsRadarChart.PolarAngleAxis dataKey="month" />
          <EChartsRadarChart.PolarRadiusAxis />
        </>
      ) as unknown,
    );
    expect(collected.grid).toEqual({ present: true, gridType: "circle" });
    expect(collected.angleAxis).toEqual({ present: true, dataKey: "month" });
    expect(collected.radiusAxis).toEqual({ present: true });
  });
});

describe("mounting", () => {
  const base = (extra?: JSX.Element) => (
    <EChartsRadarChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
      <EChartsRadarChart.PolarGrid />
      <EChartsRadarChart.PolarAngleAxis dataKey="month" />
      <EChartsRadarChart.Radar dataKey="desktop" />
      {extra}
    </EChartsRadarChart>
  );

  it("initialises ECharts and paints an SVG", () => {
    const host = mount(() => base());
    expect(host.querySelector("svg")).not.toBeNull();
  });

  it("auto-detects the angle key as the first unclaimed column", () => {
    const host = mount(() => (
      <EChartsRadarChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
        <EChartsRadarChart.PolarAngleAxis />
        <EChartsRadarChart.Radar dataKey="desktop" />
      </EChartsRadarChart>
    ));
    // `month` is the only column no <Radar> claims.
    expect(host.querySelector("svg")!.textContent).toContain("January");
  });

  it("renders both grid types", () => {
    for (const gridType of ["polygon", "circle"] as const) {
      const host = mount(() => (
        <EChartsRadarChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
          <EChartsRadarChart.PolarGrid gridType={gridType} />
          <EChartsRadarChart.Radar dataKey="desktop" />
        </EChartsRadarChart>
      ));
      expect(host.querySelector("svg"), gridType).not.toBeNull();
    }
  });

  it("renders multiple overlaid radars", () => {
    const host = mount(() =>
      base(<EChartsRadarChart.Radar dataKey="mobile" variant="lines" />),
    );
    expect(host.querySelector("svg")).not.toBeNull();
  });

  it("tears down on dispose", () => {
    const host = mount(() => base());
    expect(host.querySelector("svg")).not.toBeNull();
    disposers.pop()!();
    expect(host.querySelector("svg")).toBeNull();
  });
});

describe("selection", () => {
  it("toggles and reports from the legend", () => {
    const onSelectionChange = vi.fn();
    const host = mount(() => (
      <EChartsRadarChart
        data={DATA}
        config={CONFIG}
        renderer="svg"
        animation={false}
        onSelectionChange={onSelectionChange}
      >
        <EChartsRadarChart.Legend isClickable />
        <EChartsRadarChart.Radar dataKey="desktop" isClickable />
        <EChartsRadarChart.Radar dataKey="mobile" isClickable />
      </EChartsRadarChart>
    ));
    const entries = [
      ...host.querySelectorAll("[style*='position: absolute'] > div"),
    ] as HTMLElement[];

    entries[0]!.click();
    expect(onSelectionChange).toHaveBeenLastCalledWith("desktop");
    expect(entries[1]!.className).toContain("opacity-30");
  });
});

describe("loading", () => {
  it("shows the badge and hides the legend", () => {
    const host = mount(() => (
      <EChartsRadarChart data={DATA} config={CONFIG} renderer="svg" animation={false} isLoading>
        <EChartsRadarChart.Legend />
        <EChartsRadarChart.Radar dataKey="desktop" />
      </EChartsRadarChart>
    ));
    expect(host.textContent).toContain("Loading");
    expect(host.textContent).not.toContain("Desktop");
  });
});
