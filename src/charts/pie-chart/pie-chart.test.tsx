import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { createSignal, type JSX } from "solid-js";

import { BACKGROUND_PATTERNS } from "./background";
import {
  buildLoadingOption,
  buildPieSeries,
  buildShimmerSectors,
  createTooltipFormatter,
  loadingSectorAlpha,
  pieCenterY,
  sectorBorder,
  sectorPaint,
  type OptionBuildContext,
} from "./options";
import { collectConfig } from "./parts";
import { EChartsPieChart } from "./pie-chart";
import {
  DIMMED_OPACITY,
  LOADING_BASE_OPACITY,
  LOADING_PEAK_OPACITY,
  LOADING_SECTORS,
  OVERLAP_BORDER_WIDTH,
  SELECTED_OFFSET,
  type BackgroundVariant,
  type ChartConfig,
} from "./types";
import type { ResolvedColors } from "../../lib/chart-tokens";
import * as echarts from "echarts/core";

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
    data: DATA,
    config: CONFIG,
    nameKey: "browser",
    dataKey: "visitors",
    pie: {
      variant: "gradient",
      innerRadius: 0,
      outerRadius: "80%",
      cornerRadius: 0,
      paddingAngle: 0,
      startAngle: 0,
      endAngle: 360,
      isClickable: false,
      labelDataKey: null,
      labelPosition: "inside",
    },
    selectedSector: null,
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

describe("sectorBorder", () => {
  it("draws nothing at zero padding", () => {
    expect(sectorBorder(0, "#fff")).toBeNull();
  });

  it("turns a POSITIVE padding into a constant-width border, not an angular pad", () => {
    // An angular pad tapers to a wedge toward the centre; a border stays
    // parallel-edged from the rim in.
    expect(sectorBorder(4, "#fff")).toEqual({ borderColor: "#fff", borderWidth: 4 });
  });

  it("gives a NEGATIVE padding the wide overlap separator", () => {
    expect(sectorBorder(-4, "#fff")).toEqual({
      borderColor: "#fff",
      borderWidth: OVERLAP_BORDER_WIDTH,
    });
  });
});

describe("sectorPaint", () => {
  it("returns a plain colour for one slot", () => {
    expect(sectorPaint(["rgba(0, 170, 0, 1)"])).toBe("rgba(0, 170, 0, 1)");
  });

  it("runs multi-colour gradients DIAGONALLY — a wedge has no horizontal axis", () => {
    const g = sectorPaint(["#a", "#b"]) as echarts.graphic.LinearGradient;
    expect([g.x, g.y, g.x2, g.y2]).toEqual([0, 0, 1, 1]);
  });
});

describe("pieCenterY", () => {
  const slot = (verticalAlign: "top" | "middle" | "bottom", present = true) =>
    ({
      present,
      variant: "rounded-square",
      align: "center",
      verticalAlign,
      isClickable: false,
    }) as const;

  it("centres the pie with no legend", () => {
    expect(pieCenterY(slot("bottom", false))).toBe("50%");
  });

  it("nudges the pie AWAY from the legend", () => {
    expect(pieCenterY(slot("bottom"))).toBe("45%");
    expect(pieCenterY(slot("top"))).toBe("55%");
    expect(pieCenterY(slot("middle"))).toBe("50%");
  });
});

describe("loadingSectorAlpha", () => {
  it("rests at the base opacity far from the window", () => {
    expect(loadingSectorAlpha(0.5, 0)).toBe(LOADING_BASE_OPACITY);
  });

  it("peaks at the window centre", () => {
    expect(loadingSectorAlpha(0.5, 0.5)).toBe(LOADING_PEAK_OPACITY);
  });

  it("wraps AROUND the ring, so the sweep never jumps at 12 o'clock", () => {
    // 0.98 and 0.02 are 0.04 apart the short way, not 0.96.
    expect(loadingSectorAlpha(0.98, 0.02)).toBe(LOADING_PEAK_OPACITY);
  });

  it("eases between base and peak across the feather", () => {
    const mid = loadingSectorAlpha(0.5 + 0.28 - 0.11, 0.5);
    expect(mid).toBeGreaterThan(LOADING_BASE_OPACITY);
    expect(mid).toBeLessThan(LOADING_PEAK_OPACITY);
  });
});

describe("buildPieSeries", () => {
  it("emits one sector per row, named by nameKey", () => {
    const series = buildPieSeries(ctx());
    const sectors = series[0]!.data as { name: string; value: number }[];
    expect(sectors.map((s) => s.name)).toEqual(["chrome", "safari", "firefox"]);
    expect(sectors.map((s) => s.value)).toEqual([275, 200, 187]);
  });

  it("sweeps counterclockwise, matching the Recharts twin's sector order", () => {
    expect(buildPieSeries(ctx())[0]!.clockwise).toBe(false);
  });

  it("sends only NEGATIVE padding to padAngle", () => {
    const pieSlot = ctx().pie!;
    expect(buildPieSeries(ctx({ pie: { ...pieSlot, paddingAngle: 4 } }))[0]!.padAngle).toBe(0);
    expect(buildPieSeries(ctx({ pie: { ...pieSlot, paddingAngle: -4 } }))[0]!.padAngle).toBe(-4);
  });

  it("does not dim a NON-clickable pie, even with a selection", () => {
    const series = buildPieSeries(ctx({ selectedSector: "chrome" }));
    const sectors = series[0]!.data as { itemStyle: { opacity: number } }[];
    expect(sectors.every((s) => s.itemStyle.opacity === 1)).toBe(true);
  });

  it("dims the others and marks the selected one on a clickable pie", () => {
    const pieSlot = { ...ctx().pie!, isClickable: true };
    const series = buildPieSeries(ctx({ pie: pieSlot, selectedSector: "chrome" }));
    const sectors = series[0]!.data as {
      selected: boolean;
      itemStyle: { opacity: number };
    }[];
    expect(sectors[0]!.selected).toBe(true);
    expect(sectors[0]!.itemStyle.opacity).toBe(1);
    expect(sectors[1]!.itemStyle.opacity).toBe(DIMMED_OPACITY);
  });

  it("enables the pop-out only when clickable", () => {
    expect(buildPieSeries(ctx())[0]!.selectedMode).toBe(false);
    const pieSlot = { ...ctx().pie!, isClickable: true };
    const series = buildPieSeries(ctx({ pie: pieSlot }));
    expect(series[0]!.selectedMode).toBe("single");
    expect(series[0]!.selectedOffset).toBe(SELECTED_OFFSET);
  });

  it("never scales on hover — the pop-out is the only selection affordance", () => {
    expect(buildPieSeries(ctx())[0]!.emphasis).toEqual({ scale: false });
  });

  it("hides labels and leader lines when no <Label> is declared", () => {
    const series = buildPieSeries(ctx());
    expect(series[0]!.label?.show).toBe(false);
    expect(series[0]!.labelLine?.show).toBe(false);
  });

  describe("labels", () => {
    const withLabel = (
      labelPosition: "inside" | "outside",
      labelDataKey: string | null = "",
    ) => ctx({ pie: { ...ctx().pie!, labelDataKey, labelPosition } });

    it("puts INSIDE labels on the sector, showing the value", () => {
      const series = buildPieSeries(withLabel("inside"));
      expect(series[0]!.label?.position).toBe("inner");
      const formatter = series[0]!.label?.formatter as (p: {
        dataIndex: number;
      }) => string;
      expect(formatter({ dataIndex: 0 })).toBe("275");
      expect(series[0]!.labelLine?.show).toBe(false);
    });

    it("puts OUTSIDE labels past the rim with a leader, showing the name", () => {
      const series = buildPieSeries(withLabel("outside"));
      expect(series[0]!.label?.position).toBe("outside");
      const formatter = series[0]!.label?.formatter as (p: {
        dataIndex: number;
        name: string;
      }) => string;
      expect(formatter({ dataIndex: 0, name: "chrome" })).toBe("Chrome");
      expect(series[0]!.labelLine?.show).toBe(true);
    });

    it("lets an explicit dataKey win over both defaults", () => {
      const series = buildPieSeries(withLabel("outside", "browser"));
      const formatter = series[0]!.label?.formatter as (p: {
        dataIndex: number;
        name: string;
      }) => string;
      expect(formatter({ dataIndex: 1, name: "safari" })).toBe("safari");
    });
  });
});

describe("loading skeleton", () => {
  it("draws equal sectors regardless of the real data", () => {
    const option = buildLoadingOption(ctx({ isLoading: true }));
    const series = option.series as { data: { value: number }[] }[];
    expect(series[0]!.data).toHaveLength(LOADING_SECTORS);
    expect(series[0]!.data.every((d) => d.value === 1)).toBe(true);
  });

  it("keeps a donut a donut", () => {
    const pieSlot = { ...ctx().pie!, innerRadius: "60%" };
    const option = buildLoadingOption(ctx({ isLoading: true, pie: pieSlot }));
    const series = option.series as { radius: [string | number, string | number] }[];
    expect(series[0]!.radius[0]).toBe("60%");
  });

  it("rebuilds the FULL itemStyle each shimmer frame", () => {
    // setOption replaces a series' data array wholesale, so a partial datum
    // would silently drop the border and rounding.
    const sectors = buildShimmerSectors({
      phase: 0.5,
      foreground: "rgba(0, 0, 0, 1)",
      background: "rgba(255, 255, 255, 1)",
      cornerRadius: 4,
      paddingAngle: 3,
    });
    expect(sectors).toHaveLength(LOADING_SECTORS);
    expect(sectors[0]!.itemStyle.borderRadius).toBe(4);
    expect(sectors[0]!.itemStyle.borderWidth).toBe(3);
  });

  it("brightens the sector under the sweep", () => {
    const sectors = buildShimmerSectors({
      phase: 0.5,
      foreground: "rgba(0, 0, 0, 1)",
      background: "rgba(255, 255, 255, 1)",
      cornerRadius: 0,
      paddingAngle: 0,
    });
    // Middle sector sits at the window centre; the first is far from it.
    const alphas = sectors.map((s) => Number(String(s.itemStyle.color).match(/[\d.]+\)$/)![0].slice(0, -1)));
    expect(alphas[2]!).toBeGreaterThan(alphas[0]!);
  });
});

describe("tooltip formatter", () => {
  it("renders exactly one row — the pie tooltip is item-triggered", () => {
    const html = createTooltipFormatter(ctx())({ name: "chrome", value: 275 });
    expect(html).toContain("Chrome");
    expect(html).toContain("275");
  });

  it("renders NO header row, unlike the cartesian tooltips", () => {
    const html = createTooltipFormatter(ctx())({ name: "chrome", value: 275 });
    expect(html).not.toContain("font-medium text-primary");
  });

  it("drops the loading skeleton's series", () => {
    expect(
      createTooltipFormatter(ctx())({ name: "__loading-0", value: 1, seriesId: "__loading" }),
    ).toBe("");
  });

  it("dims a row when another sector is selected", () => {
    const html = createTooltipFormatter(ctx({ selectedSector: "safari" }))({
      name: "chrome",
      value: 275,
    });
    expect(html).toContain("opacity-30");
  });
});

describe("collectConfig", () => {
  it("returns a null pie when none is declared", () => {
    expect(collectConfig((<EChartsPieChart.Tooltip />) as unknown).pie).toBeNull();
  });

  it("defaults the pie's shape", () => {
    const collected = collectConfig((<EChartsPieChart.Pie />) as unknown);
    expect(collected.pie).toMatchObject({
      variant: "gradient",
      innerRadius: 0,
      outerRadius: "80%",
      cornerRadius: 0,
      paddingAngle: 0,
      startAngle: 0,
      endAngle: 360,
      isClickable: false,
      labelDataKey: null,
    });
  });

  it("reads <Label> out of the non-rendering <Pie>", () => {
    const collected = collectConfig(
      (
        <EChartsPieChart.Pie>
          <EChartsPieChart.Label position="outside" />
        </EChartsPieChart.Pie>
      ) as unknown,
    );
    expect(collected.pie!.labelPosition).toBe("outside");
    // "" means present-but-defaulted, distinct from null (absent).
    expect(collected.pie!.labelDataKey).toBe("");
  });

  it("defaults the legend to CENTRE-BOTTOM, unlike the cartesian charts", () => {
    const collected = collectConfig((<EChartsPieChart.Legend />) as unknown);
    expect(collected.legend).toMatchObject({ align: "center", verticalAlign: "bottom" });
  });

  it("defaults the background pattern to dots", () => {
    const collected = collectConfig((<EChartsPieChart.Background />) as unknown);
    expect(collected.background).toEqual({ present: true, variant: "dots" });
  });
});

describe("background patterns", () => {
  it("covers every declared variant", () => {
    const variants: BackgroundVariant[] = [
      "dots",
      "grid",
      "cross-hatch",
      "diagonal-lines",
      "plus",
      "falling-triangles",
      "4-pointed-star",
      "tiny-checkers",
      "overlapping-circles",
      "wiggle-lines",
      "bubbles",
    ];
    for (const variant of variants) {
      expect(BACKGROUND_PATTERNS[variant], variant).toBeTypeOf("function");
    }
  });

  it("renders SVG attributes in kebab-case so they reach the DOM", () => {
    const host = mount(() => (
      <svg>
        <BackgroundPatternProbe />
      </svg>
    ));
    const path = host.querySelector("path");
    // React's camelCase strokeWidth would land as an unknown attribute here.
    expect(path?.getAttribute("stroke-width")).toBe("0.5");
    expect(path?.getAttribute("strokeWidth")).toBeNull();
  });
});

function BackgroundPatternProbe() {
  const Pattern = BACKGROUND_PATTERNS.grid;
  return <Pattern id="probe" />;
}

describe("mounting", () => {
  it("initialises ECharts and paints an SVG", () => {
    const host = mount(() => (
      <EChartsPieChart
        data={DATA}
        config={CONFIG}
        dataKey="visitors"
        nameKey="browser"
        renderer="svg"
        animation={false}
      >
        <EChartsPieChart.Pie />
      </EChartsPieChart>
    ));
    expect(host.querySelector("svg")).not.toBeNull();
  });

  it("keys colour vars by SECTOR NAME, not a series column", () => {
    const host = mount(() => (
      <EChartsPieChart
        data={DATA}
        config={CONFIG}
        dataKey="visitors"
        nameKey="browser"
        renderer="svg"
        animation={false}
      >
        <EChartsPieChart.Pie />
      </EChartsPieChart>
    ));
    const style = host.querySelector("style")!;
    expect(style.innerHTML).toContain("--color-chrome-0: #047857;");
    expect(style.innerHTML).toContain("--color-safari-0: #be123c;");
  });

  it("renders the background layer only when declared", () => {
    const without = mount(() => (
      <EChartsPieChart
        data={DATA}
        config={CONFIG}
        dataKey="visitors"
        nameKey="browser"
        renderer="svg"
        animation={false}
      >
        <EChartsPieChart.Pie />
      </EChartsPieChart>
    ));
    expect(without.querySelector("pattern")).toBeNull();

    const with_ = mount(() => (
      <EChartsPieChart
        data={DATA}
        config={CONFIG}
        dataKey="visitors"
        nameKey="browser"
        renderer="svg"
        animation={false}
      >
        <EChartsPieChart.Background variant="grid" />
        <EChartsPieChart.Pie />
      </EChartsPieChart>
    ));
    expect(with_.querySelector("pattern")).not.toBeNull();
  });

  it("tears down on dispose", () => {
    const host = mount(() => (
      <EChartsPieChart
        data={DATA}
        config={CONFIG}
        dataKey="visitors"
        nameKey="browser"
        renderer="svg"
        animation={false}
      >
        <EChartsPieChart.Pie />
      </EChartsPieChart>
    ));
    expect(host.querySelector("svg")).not.toBeNull();
    disposers.pop()!();
    expect(host.querySelector("svg")).toBeNull();
  });
});

describe("selection", () => {
  const legendEntries = (host: HTMLElement) =>
    [...host.querySelectorAll("[style*='position: absolute'] > div")] as HTMLElement[];

  it("reports the sector NAME and its value, not just a key", () => {
    const onSelectionChange = vi.fn();
    const host = mount(() => (
      <EChartsPieChart
        data={DATA}
        config={CONFIG}
        dataKey="visitors"
        nameKey="browser"
        renderer="svg"
        animation={false}
        onSelectionChange={onSelectionChange}
      >
        <EChartsPieChart.Legend isClickable />
        <EChartsPieChart.Pie isClickable />
      </EChartsPieChart>
    ));

    legendEntries(host)[0]!.click();
    expect(onSelectionChange).toHaveBeenLastCalledWith({ dataKey: "chrome", value: 275 });

    legendEntries(host)[0]!.click();
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });

  it("honours a controlled selectedSector", () => {
    const [selected, setSelected] = createSignal<string | null>("safari");
    const host = mount(() => (
      <EChartsPieChart
        data={DATA}
        config={CONFIG}
        dataKey="visitors"
        nameKey="browser"
        renderer="svg"
        animation={false}
        selectedSector={selected()}
      >
        <EChartsPieChart.Legend />
        <EChartsPieChart.Pie isClickable />
      </EChartsPieChart>
    ));

    expect(legendEntries(host)[0]!.className).toContain("opacity-30");
    setSelected("chrome");
    expect(legendEntries(host)[0]!.className).not.toContain("opacity-30");
  });
});

describe("loading", () => {
  it("shows the badge and hides the legend", () => {
    const host = mount(() => (
      <EChartsPieChart
        data={DATA}
        config={CONFIG}
        dataKey="visitors"
        nameKey="browser"
        renderer="svg"
        animation={false}
        isLoading
      >
        <EChartsPieChart.Legend />
        <EChartsPieChart.Pie />
      </EChartsPieChart>
    ));
    expect(host.textContent).toContain("Loading");
    expect(host.textContent).not.toContain("Chrome");
  });
});
