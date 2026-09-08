import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import type { JSX } from "solid-js";
import * as echarts from "echarts/core";

import type { ResolvedColors } from "../../lib/chart-tokens";
import {
  buildInsidePlateSeries,
  buildLoadingOption,
  buildNodeLabel,
  buildSankeySeries,
  computeNodeDepths,
  computeNodeValues,
  connectedNodeSet,
  createTooltipFormatter,
  drawPaint,
  edgeColor,
  growPaint,
  introDuration,
  linkPhase,
  nodeGradient,
  nodePhase,
  paintAxis,
  sampleStops,
  windowedPaint,
  type OptionBuildContext,
  type Paint,
} from "./options";
import { collectConfig } from "./parts";
import { EChartsSankeyChart } from "./sankey-chart";
import {
  INTRO_COLUMN_STAGGER,
  LINK_DIM_OPACITY,
  LINK_FILL_OPACITY,
  NODE_DIM_OPACITY,
  type ChartConfig,
  type SankeyData,
} from "./types";

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

/** a → b → d, a → c → d. Two columns of flow, four nodes. */
const DATA: SankeyData = {
  nodes: [{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }],
  links: [
    { source: 0, target: 1, value: 6 },
    { source: 0, target: 2, value: 4 },
    { source: 1, target: 3, value: 6 },
    { source: 2, target: 3, value: 4 },
  ],
};

const CONFIG: ChartConfig = {
  a: { label: "Alpha", colors: { light: ["#047857"], dark: ["#10b981"] } },
  b: { label: "Bravo", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
  c: { label: "Charlie", colors: { light: ["#7c3aed"], dark: ["#a78bfa"] } },
  d: { label: "Delta", colors: { light: ["#0369a1"], dark: ["#38bdf8"] } },
};

function ctx(overrides: Partial<OptionBuildContext> = {}): OptionBuildContext {
  return {
    data: DATA,
    config: CONFIG,
    nodeConfig: { radius: 0, isClickable: false },
    nodeLabel: null,
    linkConfig: { variant: "gradient", verticalPadding: 10 },
    tooltipSlot: {
      present: false,
      variant: "default",
      roundness: "lg",
      position: "variable",
    },
    selectedNode: null,
    nodeWidth: 10,
    nodePadding: 10,
    linkCurvature: 0.5,
    iterations: 32,
    align: "justify",
    isLoading: false,
    resolved: {
      series: {
        a: ["rgba(0, 170, 0, 1)"],
        b: ["rgba(170, 0, 0, 1)"],
        c: ["rgba(120, 0, 170, 1)"],
        d: ["rgba(0, 100, 170, 1)"],
      },
      tokens: TOKENS,
    },
    nodeValues: computeNodeValues(DATA),
    outsideLabels: false,
    intro: null,
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

describe("computeNodeDepths", () => {
  it("assigns the LONGEST path from any source, so a node follows all its feeders", () => {
    expect(computeNodeDepths(DATA)).toEqual({ a: 0, b: 1, c: 1, d: 2 });
  });

  it("terminates on a cyclic graph rather than spinning", () => {
    const cyclic: SankeyData = {
      nodes: [{ name: "x" }, { name: "y" }],
      links: [
        { source: 0, target: 1, value: 1 },
        { source: 1, target: 0, value: 1 },
      ],
    };
    // The node-count cap is what stops this; the exact depths don't matter.
    expect(() => computeNodeDepths(cyclic)).not.toThrow();
  });
});

describe("computeNodeValues", () => {
  it("uses the OUTGOING sum for a node that emits", () => {
    expect(computeNodeValues(DATA).a).toBe(10);
  });

  it("falls back to incoming for a leaf", () => {
    // `d` emits nothing, so its value is what flows in.
    expect(computeNodeValues(DATA).d).toBe(10);
  });
});

describe("connectedNodeSet", () => {
  it("includes the node plus everything ONE link away, in both directions", () => {
    expect([...connectedNodeSet(DATA, "b")].sort()).toEqual(["a", "b", "d"]);
  });

  it("returns just the node when the name is unknown", () => {
    expect([...connectedNodeSet(DATA, "zzz")]).toEqual(["zzz"]);
  });
});

describe("intro timing", () => {
  const depths = { a: 0, b: 1, c: 1, d: 2 };

  it("staggers each column's nodes by INTRO_COLUMN_STAGGER", () => {
    // At exactly one stagger, column 0 is done and column 1 is only starting.
    expect(nodePhase({ elapsed: INTRO_COLUMN_STAGGER, depths }, "a")).toBeGreaterThan(0.5);
    expect(nodePhase({ elapsed: INTRO_COLUMN_STAGGER, depths }, "b")).toBe(0);
  });

  it("keys a link off its SOURCE column, so a band never precedes its node", () => {
    // At t=0 nothing has drawn; a's node is already growing.
    expect(linkPhase({ elapsed: 0, depths }, "a")).toBe(0);
    expect(linkPhase({ elapsed: 400, depths }, "a")).toBeGreaterThan(0);
    // b sits a column later, so its bands start later still.
    expect(linkPhase({ elapsed: 400, depths }, "b")).toBeLessThan(
      linkPhase({ elapsed: 400, depths }, "a"),
    );
  });

  it("clamps to 1 once a phase completes", () => {
    expect(nodePhase({ elapsed: 100_000, depths }, "d")).toBe(1);
    expect(linkPhase({ elapsed: 100_000, depths }, "a")).toBe(1);
  });

  it("runs long enough for the last column AND the bands before it", () => {
    expect(introDuration(depths)).toBeGreaterThan(2 * INTRO_COLUMN_STAGGER);
    expect(introDuration({ only: 0 })).toBeGreaterThan(0);
  });
});

describe("paint windowing", () => {
  const vertical = nodeGradient(["#f00", "#00f"]) as echarts.graphic.LinearGradient;
  const horizontal = new echarts.graphic.LinearGradient(0, 0, 1, 0, [
    { offset: 0, color: "#f00" },
    { offset: 1, color: "#00f" },
  ]);

  it("detects each paint's own axis", () => {
    expect(paintAxis(vertical)).toBe("y");
    expect(paintAxis(horizontal)).toBe("x");
    // A flat colour composes with either.
    expect(paintAxis("#f00")).toBeNull();
  });

  it("refuses to window a paint that runs along the OTHER axis", () => {
    // Two axes can't be composed into one canvas gradient, so the caller falls
    // back to a plain fade instead.
    expect(windowedPaint(vertical, "x", [0, 0.1, 0.9, 1])).toBeNull();
    expect(windowedPaint(horizontal, "y", [0, 0.1, 0.9, 1])).toBeNull();
  });

  it("windows a flat colour along either axis", () => {
    expect(windowedPaint("#f00", "x", [0, 0.1, 0.9, 1])).not.toBeNull();
    expect(windowedPaint("#f00", "y", [0, 0.1, 0.9, 1])).not.toBeNull();
  });

  it("zeroes alpha outside the window and keeps it inside", () => {
    const out = windowedPaint("rgba(255, 0, 0, 1)", "x", [
      0.2, 0.3, 0.7, 0.8,
    ]) as echarts.graphic.LinearGradient;
    const at = (offset: number) =>
      out.colorStops.find((s) => Math.abs(s.offset - offset) < 1e-9)?.color;
    expect(at(0)).toContain("0)");
    expect(at(1)).toContain("0)");
    // withAlpha normalises to "rgba(r, g, b, a.aaa)".
    expect(at(0.3)).toBe("rgba(255, 0, 0, 1.000)");
  });

  it("grows a node from its CENTRE outward", () => {
    const early = growPaint("rgba(255, 0, 0, 1)", 0) as echarts.graphic.LinearGradient;
    const late = growPaint("rgba(255, 0, 0, 1)", 1) as echarts.graphic.LinearGradient;
    // Opaque span at phase 0 is narrower than at phase 1, and both straddle 0.5.
    const span = (g: echarts.graphic.LinearGradient) => {
      const opaque = g.colorStops.filter((s) => s.color.endsWith("1.000)"));
      return (opaque[opaque.length - 1]?.offset ?? 0) - (opaque[0]?.offset ?? 0);
    };
    expect(span(early)).toBeLessThan(span(late));
    expect(span(early)).toBeGreaterThan(0);
  });

  it("draws a band from its SOURCE edge toward its target", () => {
    const early = drawPaint("rgba(255, 0, 0, 1)", 0.2) as echarts.graphic.LinearGradient;
    const late = drawPaint("rgba(255, 0, 0, 1)", 0.8) as echarts.graphic.LinearGradient;
    const head = (g: echarts.graphic.LinearGradient) => {
      const opaque = g.colorStops.filter((s) => s.color.endsWith("1.000)"));
      return opaque[opaque.length - 1]?.offset ?? 0;
    };
    expect(head(early)).toBeLessThan(head(late));
  });
});

describe("sampleStops", () => {
  const stops = [
    { offset: 0, color: "#ff0000" },
    { offset: 1, color: "#0000ff" },
  ];

  it("clamps outside the range", () => {
    expect(sampleStops(stops, -1)).toBe("#ff0000");
    expect(sampleStops(stops, 2)).toBe("#0000ff");
  });

  it("interpolates between two stops, so a window edge keeps the hue it cuts", () => {
    const mid = sampleStops(stops, 0.5);
    expect(mid).not.toBe("#ff0000");
    expect(mid).not.toBe("#0000ff");
  });
});

describe("edgeColor", () => {
  const src = ["rgba(0, 170, 0, 1)"];
  const tgt = ["rgba(170, 0, 0, 1)"];

  it("bakes the 0.2/0.5/0.2 source→target alphas into the gradient variant", () => {
    const g = edgeColor("gradient", src, tgt, "#000") as echarts.graphic.LinearGradient;
    expect(g.colorStops.map((s) => s.offset)).toEqual([0, 0.5, 1]);
    expect(g.colorStops[0]!.color).toBe("rgba(0, 170, 0, 0.200)");
    expect(g.colorStops[1]!.color).toBe("rgba(0, 170, 0, 0.500)");
    expect(g.colorStops[2]!.color).toBe("rgba(170, 0, 0, 0.200)");
  });

  it("reuses the source or target node's own paint", () => {
    expect(edgeColor("source", src, tgt, "#000")).toBe(src[0]);
    expect(edgeColor("target", src, tgt, "#000")).toBe(tgt[0]);
  });

  it("falls back to the foreground token for solid", () => {
    expect(edgeColor("solid", src, tgt, "#123")).toBe("#123");
  });
});

describe("buildSankeySeries", () => {
  it("resolves link source/target INDICES into node names", () => {
    const series = buildSankeySeries(ctx());
    const links = series.links as { source: string; target: string }[];
    expect(links[0]).toMatchObject({ source: "a", target: "b" });
  });

  it("dims nodes and links not touching the selection, links harder", () => {
    const series = buildSankeySeries(ctx({ selectedNode: "b" }));
    const nodes = series.data as { name: string; itemStyle: { opacity: number } }[];
    const links = series.links as { lineStyle: { opacity: number } }[];

    // `c` is not adjacent to `b`.
    expect(nodes.find((n) => n.name === "c")!.itemStyle.opacity).toBe(NODE_DIM_OPACITY);
    expect(nodes.find((n) => n.name === "a")!.itemStyle.opacity).toBe(1);
    // a→b touches the selection; c→d does not.
    expect(links[0]!.lineStyle.opacity).toBe(LINK_FILL_OPACITY);
    expect(links[3]!.lineStyle.opacity).toBe(LINK_DIM_OPACITY);
    expect(LINK_DIM_OPACITY).toBeLessThan(NODE_DIM_OPACITY);
  });

  it("puts outside labels on the LEFT for nodes with no incoming link", () => {
    // Otherwise the first column's text lands on its own outgoing bands.
    const series = buildSankeySeries(
      ctx({ nodeLabel: { position: "outside", showValues: false }, outsideLabels: true }),
    );
    const nodes = series.data as { name: string; label: { position?: string } }[];
    expect(nodes.find((n) => n.name === "a")!.label.position).toBe("left");
    expect(nodes.find((n) => n.name === "d")!.label.position).toBeUndefined();
  });

  it("reserves horizontal room only when outside labels are on", () => {
    expect(buildSankeySeries(ctx()).left).toBe(8);
    expect(buildSankeySeries(ctx({ outsideLabels: true })).left).toBe(120);
  });

  it("lets an EMPTY config label opt a node out entirely", () => {
    const series = buildSankeySeries(
      ctx({ config: { ...CONFIG, b: { label: "" } } }),
    );
    const nodes = series.data as { name: string; label: { show?: boolean } }[];
    expect(nodes.find((n) => n.name === "b")!.label.show).toBe(false);
    expect(nodes.find((n) => n.name === "a")!.label.show).toBeUndefined();
  });

  it("rebuilds the node as a rimmed plate when labels sit inside", () => {
    const series = buildSankeySeries(
      ctx({ nodeLabel: { position: "inside", showValues: false } }),
    );
    const nodes = series.data as {
      itemStyle: { color: string; borderWidth: number };
    }[];
    // Plate fill is a background wash; the node's own colour becomes the rim.
    expect(nodes[0]!.itemStyle.color).toContain("255, 255, 255");
    expect(nodes[0]!.itemStyle.borderWidth).toBe(1);
  });

  it("never dims on hover — hovering only surfaces the tooltip", () => {
    expect(buildSankeySeries(ctx()).emphasis).toEqual({ focus: "none" });
  });
});

describe("buildInsidePlateSeries", () => {
  it("is null unless inside labels are active", () => {
    expect(buildInsidePlateSeries(ctx())).toBeNull();
    expect(
      buildInsidePlateSeries(
        ctx({ nodeLabel: { position: "outside", showValues: false } }),
      ),
    ).toBeNull();
  });

  it("sits BELOW the real series and stays silent", () => {
    const plate = buildInsidePlateSeries(
      ctx({ nodeLabel: { position: "inside", showValues: false } }),
    )!;
    expect(plate.z).toBe(2);
    expect(buildSankeySeries(ctx()).z).toBe(3);
    expect(plate.silent).toBe(true);
  });

  it("keeps fully transparent links, so only its NODES show through", () => {
    const plate = buildInsidePlateSeries(
      ctx({ nodeLabel: { position: "inside", showValues: false } }),
    )!;
    const links = plate.links as { lineStyle: { opacity: number } }[];
    expect(links.every((l) => l.lineStyle.opacity === 0)).toBe(true);
  });

  it("mirrors the main series' layout exactly, so the two register", () => {
    const inside = ctx({ nodeLabel: { position: "inside", showValues: false } });
    const plate = buildInsidePlateSeries(inside)!;
    const main = buildSankeySeries(inside);
    expect([plate.left, plate.right, plate.nodeWidth, plate.nodeGap]).toEqual([
      main.left,
      main.right,
      main.nodeWidth,
      main.nodeGap,
    ]);
  });
});

describe("buildNodeLabel", () => {
  it("shows nothing without a <NodeLabel>, or with one that has no position", () => {
    expect(buildNodeLabel(ctx())).toEqual({ show: false });
    expect(buildNodeLabel(ctx({ nodeLabel: { showValues: false } }))).toEqual({
      show: false,
    });
  });

  it("places inside labels centred and outside labels to the right", () => {
    const inside = buildNodeLabel(
      ctx({ nodeLabel: { position: "inside", showValues: false } }),
    );
    expect(inside).toMatchObject({ position: "inside", align: "center" });
    const outside = buildNodeLabel(
      ctx({ nodeLabel: { position: "outside", showValues: false } }),
    );
    expect(outside).toMatchObject({ position: "right", align: "left" });
  });

  it("appends the node's total flow when showValues is on", () => {
    const label = buildNodeLabel(
      ctx({ nodeLabel: { position: "outside", showValues: true } }),
    );
    const formatter = label!.formatter as (p: unknown) => string;
    expect(formatter({ name: "a" })).toBe("{name|Alpha}\n{value|10}");
  });

  it("honours a custom valueFormatter", () => {
    const label = buildNodeLabel(
      ctx({
        nodeLabel: {
          position: "outside",
          showValues: true,
          valueFormatter: (v) => `${v} units`,
        },
      }),
    );
    const formatter = label!.formatter as (p: unknown) => string;
    expect(formatter({ name: "a" })).toContain("10 units");
  });
});

describe("tooltip formatter", () => {
  it("renders a NODE row with its total flow", () => {
    const html = createTooltipFormatter(ctx())({ dataType: "node", name: "a" });
    expect(html).toContain("Alpha");
    expect(html).toContain("10");
  });

  it("renders an EDGE row as source → target", () => {
    const html = createTooltipFormatter(ctx())({
      dataType: "edge",
      data: { source: "a", target: "b", value: 6 },
    });
    expect(html).toContain("Alpha → Bravo");
    expect(html).toContain("6");
  });
});

describe("loading skeleton", () => {
  it("draws a FIXED graph, not the real data", () => {
    const option = buildLoadingOption(ctx({ isLoading: true }));
    const series = option.series as { data: { name: string }[] }[];
    expect(series[0]!.data.map((n) => n.name)).toContain("s0");
    expect(series[0]!.data.map((n) => n.name)).not.toContain("a");
  });

  it("starts fully transparent until the first shimmer tick", () => {
    const option = buildLoadingOption(ctx({ isLoading: true }));
    const series = option.series as {
      itemStyle: { color: string };
      lineStyle: { color: string };
    }[];
    expect(series[0]!.itemStyle.color).toBe("rgba(0, 0, 0, 0.000)");
    expect(series[0]!.lineStyle.color).toBe("rgba(0, 0, 0, 0.000)");
  });
});

describe("collectConfig", () => {
  it("applies node and link defaults with no markers at all", () => {
    const collected = collectConfig(undefined);
    expect(collected.node).toEqual({ radius: 0, isClickable: false });
    expect(collected.link.variant).toBe("gradient");
    expect(collected.nodeLabel).toBeNull();
    expect(collected.tooltip.present).toBe(false);
  });

  it("reads <NodeLabel> out of the non-rendering <Node>", () => {
    const collected = collectConfig(
      (
        <EChartsSankeyChart.Node radius={4} isClickable>
          <EChartsSankeyChart.NodeLabel position="inside" showValues />
        </EChartsSankeyChart.Node>
      ) as unknown,
    );
    expect(collected.node).toEqual({ radius: 4, isClickable: true });
    expect(collected.nodeLabel).toMatchObject({ position: "inside", showValues: true });
  });

  it("collects the link variant", () => {
    const collected = collectConfig(
      (<EChartsSankeyChart.Link variant="source" />) as unknown,
    );
    expect(collected.link.variant).toBe("source");
  });
});

describe("mounting", () => {
  const base = (extra?: JSX.Element) => (
    <EChartsSankeyChart
      data={DATA}
      config={CONFIG}
      renderer="svg"
      animation={false}
      class="h-full w-full"
    >
      <EChartsSankeyChart.Node />
      {extra}
    </EChartsSankeyChart>
  );

  it("initialises ECharts and paints an SVG", () => {
    const host = mount(() => base());
    expect(host.querySelector("svg")).not.toBeNull();
  });

  it("keys colour vars by NODE NAME", () => {
    const host = mount(() => base());
    const style = host.querySelector("style")!;
    expect(style.innerHTML).toContain("--color-a-0: #047857;");
    expect(style.innerHTML).toContain("--color-d-0: #38bdf8;");
  });

  it("renders every link variant", () => {
    for (const variant of ["gradient", "solid", "source", "target"] as const) {
      const host = mount(() => base(<EChartsSankeyChart.Link variant={variant} />));
      expect(host.querySelector("svg"), variant).not.toBeNull();
    }
  });

  it("renders both label positions", () => {
    for (const position of ["inside", "outside"] as const) {
      const host = mount(() => (
        <EChartsSankeyChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
          <EChartsSankeyChart.Node>
            <EChartsSankeyChart.NodeLabel position={position} showValues />
          </EChartsSankeyChart.Node>
        </EChartsSankeyChart>
      ));
      expect(host.querySelector("svg"), position).not.toBeNull();
    }
  });

  it("tears down on dispose", () => {
    const host = mount(() => base());
    expect(host.querySelector("svg")).not.toBeNull();
    disposers.pop()!();
    expect(host.querySelector("svg")).toBeNull();
  });

  it("shows the loading badge", () => {
    const host = mount(() => (
      <EChartsSankeyChart data={DATA} config={CONFIG} renderer="svg" isLoading>
        <EChartsSankeyChart.Node />
      </EChartsSankeyChart>
    ));
    expect(host.textContent).toContain("Loading");
  });

  it("accepts sort and verticalAlign without using them", () => {
    // Both exist for Recharts prop-surface parity and have no ECharts analogue.
    const onSelectionChange = vi.fn();
    const host = mount(() => (
      <EChartsSankeyChart
        data={DATA}
        config={CONFIG}
        renderer="svg"
        animation={false}
        sort
        verticalAlign="top"
        onSelectionChange={onSelectionChange}
      >
        <EChartsSankeyChart.Node />
      </EChartsSankeyChart>
    ));
    expect(host.querySelector("svg")).not.toBeNull();
  });
});
