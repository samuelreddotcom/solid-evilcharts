import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import type { JSX } from "solid-js";
import * as echarts from "echarts/core";

import type { ResolvedColors } from "../../lib/chart-tokens";
import {
  barPaint,
  buildAngleAxis,
  buildBarSeries,
  buildLoadingOption,
  buildPolar,
  buildRadiusAxis,
  buildTrackSeries,
  createTooltipFormatter,
  getVariantGeometry,
  niceCeil,
  type OptionBuildContext,
} from "./options";
import { collectConfig } from "./parts";
import { EChartsRadialChart } from "./radial-chart";
import {
  DEFAULT_BAR_SIZE,
  DEFAULT_CORNER_RADIUS,
  LOADING_BARS,
  MAIN_SERIES_ID,
  SELECTED_DIM_OPACITY,
  TRACK_POLAR_INDEX,
  TRACK_SERIES_ID,
  type ChartConfig,
} from "./types";

beforeAll(() => {
  for (const [prop, value] of [
    ["clientWidth", 600],
    ["clientHeight", 320],
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
  { browser: "chrome", visitors: 275 },
  { browser: "safari", visitors: 200 },
  { browser: "firefox", visitors: 187 },
];

const CONFIG: ChartConfig = {
  chrome: { label: "Chrome", colors: { light: ["#047857"], dark: ["#10b981"] } },
  safari: { label: "Safari", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
  firefox: { label: "Firefox", colors: { light: ["#7c3aed"], dark: ["#a78bfa"] } },
};

function ctx(overrides: Partial<OptionBuildContext> = {}): OptionBuildContext {
  return {
    config: CONFIG,
    categories: ["chrome", "safari", "firefox"],
    values: [275, 200, 187],
    radialBar: {
      dataKey: "visitors",
      cornerRadius: DEFAULT_CORNER_RADIUS,
      barSize: DEFAULT_BAR_SIZE,
      showBackground: false,
      isClickable: false,
    },
    variant: "full",
    innerRadius: "30%",
    outerRadius: "100%",
    angleMax: 300,
    selectedBar: null,
    hasSelection: false,
    tooltipSlot: {
      present: false,
      variant: "default",
      roundness: "lg",
      position: "variable",
    },
    isLoading: false,
    loadingData: () => [50, 60, 70, 80, 90],
    resolved: {
      series: {
        chrome: ["rgba(0, 170, 0, 1)"],
        safari: ["rgba(170, 0, 0, 1)"],
        firefox: ["rgba(120, 0, 170, 1)"],
      },
      tokens: TOKENS,
    },
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

describe("getVariantGeometry", () => {
  it("sweeps a full turn from 12 o'clock, centred", () => {
    expect(getVariantGeometry("full")).toEqual({
      center: ["50%", "50%"],
      startAngle: 90,
      endAngle: -270,
    });
  });

  it("drops the centre for a semi arc, so it sits centred in the box", () => {
    // A half circle rests on its diameter; keeping centre at 50% would float it
    // in the upper half of the container.
    const semi = getVariantGeometry("semi");
    expect(semi.center).toEqual(["50%", "70%"]);
    expect(semi.startAngle - semi.endAngle).toBe(180);
  });
});

describe("niceCeil", () => {
  it("rounds up to a 1/2/5 × power-of-ten ceiling", () => {
    expect(niceCeil(275)).toBe(300);
    expect(niceCeil(42)).toBe(50);
    expect(niceCeil(23)).toBe(25);
    // Small values land on an interval of 1, so they are already nice.
    expect(niceCeil(7)).toBe(7);
  });

  it("leaves an exact nice value alone", () => {
    expect(niceCeil(300)).toBe(300);
    expect(niceCeil(100)).toBe(100);
  });

  it("guards against zero and non-finite input", () => {
    expect(niceCeil(0)).toBe(1);
    expect(niceCeil(-5)).toBe(1);
    expect(niceCeil(NaN)).toBe(1);
  });
});

describe("polar and axes", () => {
  it("builds TWO identical polars", () => {
    // The track can't share polar 0: bars on one polar share a category band, so
    // a second series there would halve every ring's thickness and offset it.
    const polars = buildPolar(ctx());
    expect(polars).toHaveLength(2);
    expect(polars[0]).toEqual(polars[1]);
  });

  it("binds one angle axis to each polar", () => {
    const axes = buildAngleAxis(ctx());
    expect(axes.map((a) => a.polarIndex)).toEqual([0, TRACK_POLAR_INDEX]);
    expect(axes.every((a) => a.max === 300)).toBe(true);
  });

  it("gives both polars identical radius bands, so ring and track align", () => {
    const axes = buildRadiusAxis(ctx());
    expect(axes.map((a) => a.polarIndex)).toEqual([0, TRACK_POLAR_INDEX]);
    // RadiusAxisOption is a union across axis types; `data` lives only on the
    // category variant, which is the one this chart always builds.
    const categoryData = (a: (typeof axes)[number]) => (a as { data?: unknown[] }).data;
    expect(categoryData(axes[0]!)).toEqual(categoryData(axes[1]!));
  });

  it("hides every axis — the rings ARE the chart", () => {
    const angle = buildAngleAxis(ctx())[0]!;
    const radius = buildRadiusAxis(ctx())[0]!;
    expect(angle.show).toBe(false);
    expect(radius.show).toBe(false);
    expect(angle.splitLine?.show).toBe(false);
  });
});

describe("barPaint", () => {
  it("returns a plain colour for one slot", () => {
    expect(barPaint(["rgba(0, 170, 0, 1)"])).toBe("rgba(0, 170, 0, 1)");
  });

  it("runs multi-colour gradients diagonally, like the pie's sectors", () => {
    const g = barPaint(["#a", "#b"]) as echarts.graphic.LinearGradient;
    expect([g.x, g.y, g.x2, g.y2]).toEqual([0, 0, 1, 1]);
  });
});

describe("buildBarSeries", () => {
  it("puts the MAIN series first, so showTip can target index 0", () => {
    const withTrack = ctx({ radialBar: { ...ctx().radialBar, showBackground: true } });
    const series = buildBarSeries(withTrack);
    expect(series[0]!.id).toBe(MAIN_SERIES_ID);
    expect(series[1]!.id).toBe(TRACK_SERIES_ID);
  });

  it("omits the track unless showBackground is set", () => {
    expect(buildBarSeries(ctx())).toHaveLength(1);
  });

  it("keeps the main series above the track by z, not array order", () => {
    const withTrack = ctx({ radialBar: { ...ctx().radialBar, showBackground: true } });
    const series = buildBarSeries(withTrack);
    expect(series[0]!.z).toBe(3);
    expect(series[1]!.z).toBe(1);
  });

  it("puts the ring series on polar 0 and the track on its own", () => {
    const withTrack = ctx({ radialBar: { ...ctx().radialBar, showBackground: true } });
    const series = buildBarSeries(withTrack);
    expect(series[0]!.polarIndex).toBe(0);
    expect(series[1]!.polarIndex).toBe(TRACK_POLAR_INDEX);
  });

  it("does NOT dim a non-clickable chart, even with a selection", () => {
    const series = buildBarSeries(ctx({ selectedBar: "chrome", hasSelection: true }));
    const data = series[0]!.data as { itemStyle: { opacity: number } }[];
    expect(data.every((d) => d.itemStyle.opacity === 1)).toBe(true);
  });

  it("dims the unselected rings on a clickable chart", () => {
    const clickable = ctx({
      radialBar: { ...ctx().radialBar, isClickable: true },
      selectedBar: "chrome",
      hasSelection: true,
    });
    const data = buildBarSeries(clickable)[0]!.data as {
      itemStyle: { opacity: number };
    }[];
    expect(data[0]!.itemStyle.opacity).toBe(1);
    expect(data[1]!.itemStyle.opacity).toBe(SELECTED_DIM_OPACITY);
  });

  it("rounds the caps only when a corner radius is set", () => {
    expect(buildBarSeries(ctx())[0]!.roundCap).toBe(true);
    const square = ctx({ radialBar: { ...ctx().radialBar, cornerRadius: 0 } });
    expect(buildBarSeries(square)[0]!.roundCap).toBe(false);
  });

  it("never emphasises on hover — the radial twin has no hover-highlight", () => {
    expect(buildBarSeries(ctx())[0]!.emphasis).toEqual({ disabled: true });
  });
});

describe("buildTrackSeries", () => {
  it("fills the full angular extent, so the track is a complete ring", () => {
    const track = buildTrackSeries(ctx(), false);
    expect(track.data).toEqual([300, 300, 300]);
  });

  it("never animates — only the data rings sweep in", () => {
    expect(buildTrackSeries(ctx(), false).animation).toBe(false);
    expect(buildTrackSeries(ctx(), false).silent).toBe(true);
  });
});

describe("loading skeleton", () => {
  it("draws its own ring count regardless of the real data", () => {
    const option = buildLoadingOption(ctx({ isLoading: true }));
    const series = option.series as { id: string; data?: unknown[] }[];
    expect(series).toHaveLength(2);
    expect(series[0]!.data).toHaveLength(LOADING_BARS);
  });

  it("starts fully transparent until the first shimmer tick", () => {
    const option = buildLoadingOption(ctx({ isLoading: true }));
    const series = option.series as { itemStyle: { color: string } }[];
    expect(series[1]!.itemStyle.color).toBe("rgba(0, 0, 0, 0.000)");
  });

  it("keeps the track visible beneath the sweep", () => {
    const option = buildLoadingOption(ctx({ isLoading: true }));
    const series = option.series as { itemStyle: { color: string } }[];
    expect(series[0]!.itemStyle.color).toBe("rgba(100, 100, 100, 0.150)");
  });
});

describe("tooltip formatter", () => {
  it("labels by ring name, looked up through the category index", () => {
    const html = createTooltipFormatter(ctx())({ dataIndex: 1, value: 200 });
    expect(html).toContain("Safari");
    expect(html).toContain("200");
  });

  it("renders no header row", () => {
    const html = createTooltipFormatter(ctx())({ dataIndex: 0, value: 275 });
    expect(html).not.toContain("font-medium text-primary");
  });

  it("drops the track and the skeleton", () => {
    expect(createTooltipFormatter(ctx())({ dataIndex: 0, seriesId: "__track" })).toBe("");
    expect(createTooltipFormatter(ctx())({ dataIndex: 0, seriesId: "__loading" })).toBe("");
  });
});

describe("collectConfig", () => {
  it("always yields a radialBar slot, unlike the pie's nullable pie slot", () => {
    // Without a dataKey there is nothing to plot, so the chart renders its track
    // only rather than throwing.
    const collected = collectConfig((<EChartsRadialChart.Tooltip />) as unknown);
    expect(collected.radialBar.dataKey).toBe("");
  });

  it("applies the documented defaults", () => {
    const collected = collectConfig(
      (<EChartsRadialChart.RadialBar dataKey="visitors" />) as unknown,
    );
    expect(collected.radialBar).toEqual({
      dataKey: "visitors",
      cornerRadius: DEFAULT_CORNER_RADIUS,
      barSize: DEFAULT_BAR_SIZE,
      showBackground: false,
      isClickable: false,
    });
  });

  it("defaults the legend to centre-bottom, like the pie", () => {
    const collected = collectConfig((<EChartsRadialChart.Legend />) as unknown);
    expect(collected.legend).toMatchObject({ align: "center", verticalAlign: "bottom" });
  });
});

describe("mounting", () => {
  const base = (extra?: JSX.Element) => (
    <EChartsRadialChart
      data={DATA}
      config={CONFIG}
      nameKey="browser"
      renderer="svg"
    >
      <EChartsRadialChart.RadialBar dataKey="visitors" showBackground />
      {extra}
    </EChartsRadialChart>
  );

  it("initialises ECharts and paints an SVG", () => {
    const host = mount(() => base());
    expect(host.querySelector("svg")).not.toBeNull();
  });

  it("keys colour vars by RING NAME", () => {
    const host = mount(() => base());
    const style = host.querySelector("style")!;
    expect(style.innerHTML).toContain("--color-chrome-0: #047857;");
    expect(style.innerHTML).toContain("--color-firefox-0: #a78bfa;");
  });

  it("renders both variants", () => {
    for (const variant of ["full", "semi"] as const) {
      const host = mount(() => (
        <EChartsRadialChart
          data={DATA}
          config={CONFIG}
          nameKey="browser"
          renderer="svg"
          variant={variant}
        >
          <EChartsRadialChart.RadialBar dataKey="visitors" />
        </EChartsRadialChart>
      ));
      expect(host.querySelector("svg"), variant).not.toBeNull();
    }
  });

  it("draws the background pattern from a ROOT PROP, not a marker", () => {
    const host = mount(() => (
      <EChartsRadialChart
        data={DATA}
        config={CONFIG}
        nameKey="browser"
        renderer="svg"
        backgroundVariant="grid"
      >
        <EChartsRadialChart.RadialBar dataKey="visitors" />
      </EChartsRadialChart>
    ));
    expect(host.querySelector("pattern")).not.toBeNull();
  });

  it("omits the background when no variant is given", () => {
    const host = mount(() => base());
    expect(host.querySelector("pattern")).toBeNull();
  });

  it("tears down on dispose", () => {
    const host = mount(() => base());
    expect(host.querySelector("svg")).not.toBeNull();
    disposers.pop()!();
    expect(host.querySelector("svg")).toBeNull();
  });
});

describe("selection", () => {
  const legendEntries = (host: HTMLElement) =>
    [...host.querySelectorAll("[style*='position: absolute'] > div")] as HTMLElement[];

  it("reports the ring name and its value", () => {
    const onSelectionChange = vi.fn();
    const host = mount(() => (
      <EChartsRadialChart
        data={DATA}
        config={CONFIG}
        nameKey="browser"
        renderer="svg"
        onSelectionChange={onSelectionChange}
      >
        <EChartsRadialChart.Legend isClickable />
        <EChartsRadialChart.RadialBar dataKey="visitors" isClickable />
      </EChartsRadialChart>
    ));

    legendEntries(host)[1]!.click();
    expect(onSelectionChange).toHaveBeenLastCalledWith({ dataKey: "safari", value: 200 });

    legendEntries(host)[1]!.click();
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });
});

describe("loading", () => {
  it("shows the badge and hides the legend", () => {
    const host = mount(() => (
      <EChartsRadialChart
        data={DATA}
        config={CONFIG}
        nameKey="browser"
        renderer="svg"
        isLoading
      >
        <EChartsRadialChart.Legend />
        <EChartsRadialChart.RadialBar dataKey="visitors" />
      </EChartsRadialChart>
    ));
    expect(host.textContent).toContain("Loading");
    expect(host.textContent).not.toContain("Chrome");
  });
});
