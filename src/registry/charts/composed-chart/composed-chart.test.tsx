import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import type { JSX } from "solid-js";

import { EChartsComposedChart } from "./composed-chart";
import { collectConfig } from "./parts";
import type { ChartConfig } from "./types";

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

const DATA = [
  { month: "January", revenue: 342, target: 400 },
  { month: "February", revenue: 876, target: 700 },
  { month: "March", revenue: 512, target: 550 },
];

const CONFIG: ChartConfig = {
  revenue: { label: "Revenue", colors: { light: ["#047857"], dark: ["#10b981"] } },
  target: { label: "Target", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
};

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

describe("collectConfig", () => {
  it("keeps bars and lines in separate lists", () => {
    const collected = collectConfig(
      (
        <>
          <EChartsComposedChart.Bar dataKey="revenue" />
          <EChartsComposedChart.Line dataKey="target" />
        </>
      ) as unknown,
    );
    expect(collected.bars.map((b) => b.dataKey)).toEqual(["revenue"]);
    expect(collected.lines.map((l) => l.dataKey)).toEqual(["target"]);
  });

  it("separates them regardless of declaration order", () => {
    // The option builder always emits bars first, whatever the JSX order.
    const collected = collectConfig(
      (
        <>
          <EChartsComposedChart.Line dataKey="target" />
          <EChartsComposedChart.Bar dataKey="revenue" />
        </>
      ) as unknown,
    );
    expect(collected.bars).toHaveLength(1);
    expect(collected.lines).toHaveLength(1);
  });

  it("reads dots out of a <Line> but not a <Bar>", () => {
    const collected = collectConfig(
      (
        <EChartsComposedChart.Line dataKey="target">
          <EChartsComposedChart.Dot variant="border" />
          <EChartsComposedChart.ActiveDot variant="ping" />
        </EChartsComposedChart.Line>
      ) as unknown,
    );
    expect(collected.lines[0]!.dotVariant).toBe("border");
    expect(collected.lines[0]!.activeDotVariant).toBe("ping");
  });

  it("defaults a <Line> to a solid stroke and a <Bar> to radius 4", () => {
    const collected = collectConfig(
      (
        <>
          <EChartsComposedChart.Bar dataKey="revenue" />
          <EChartsComposedChart.Line dataKey="target" />
        </>
      ) as unknown,
    );
    expect(collected.lines[0]!.strokeVariant).toBe("solid");
    expect(collected.bars[0]!.radius).toBe(4);
  });
});

describe("mounting", () => {
  it("renders bars and lines together", () => {
    const host = mount(() => (
      <EChartsComposedChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
        <EChartsComposedChart.Bar dataKey="revenue" />
        <EChartsComposedChart.Line dataKey="target" />
      </EChartsComposedChart>
    ));
    const svg = host.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.querySelectorAll("path, rect").length).toBeGreaterThanOrEqual(4);
  });

  it("injects colour vars for both series and both themes", () => {
    const host = mount(() => (
      <EChartsComposedChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
        <EChartsComposedChart.Bar dataKey="revenue" />
        <EChartsComposedChart.Line dataKey="target" />
      </EChartsComposedChart>
    ));
    const style = host.querySelector("style")!;
    expect(style.innerHTML).toContain("--color-revenue-0: #047857;");
    expect(style.innerHTML).toContain("--color-target-0: #f43f5e;");
  });

  it("renders every bar variant without throwing", () => {
    for (const variant of [
      "default",
      "hatched",
      "duotone",
      "duotone-reverse",
      "gradient",
      "stripped",
    ] as const) {
      const host = mount(() => (
        <EChartsComposedChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
          <EChartsComposedChart.Bar dataKey="revenue" variant={variant} />
          <EChartsComposedChart.Line dataKey="target" />
        </EChartsComposedChart>
      ));
      expect(host.querySelector("svg"), variant).not.toBeNull();
    }
  });

  it("renders glow on both a bar and a line", () => {
    const host = mount(() => (
      <EChartsComposedChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
        <EChartsComposedChart.Bar dataKey="revenue" glow />
        <EChartsComposedChart.Line dataKey="target" glow />
      </EChartsComposedChart>
    ));
    expect(host.querySelector("svg")).not.toBeNull();
  });

  it("tears down on dispose", () => {
    const host = mount(() => (
      <EChartsComposedChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
        <EChartsComposedChart.Bar dataKey="revenue" />
      </EChartsComposedChart>
    ));
    expect(host.querySelector("svg")).not.toBeNull();
    disposers.pop()!();
    expect(host.querySelector("svg")).toBeNull();
  });
});

describe("legend and selection", () => {
  it("lists bars before lines, matching the series order", () => {
    const host = mount(() => (
      <EChartsComposedChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
        <EChartsComposedChart.Legend />
        <EChartsComposedChart.Line dataKey="target" />
        <EChartsComposedChart.Bar dataKey="revenue" />
      </EChartsComposedChart>
    ));
    const entries = [
      ...host.querySelectorAll("[style*='position: absolute'] > div"),
    ] as HTMLElement[];
    expect(entries.map((e) => e.textContent)).toEqual(["Revenue", "Target"]);
  });

  it("toggles selection across both kinds", () => {
    const onSelectionChange = vi.fn();
    const host = mount(() => (
      <EChartsComposedChart
        data={DATA}
        config={CONFIG}
        renderer="svg"
        animation={false}
        onSelectionChange={onSelectionChange}
      >
        <EChartsComposedChart.Legend isClickable />
        <EChartsComposedChart.Bar dataKey="revenue" isClickable />
        <EChartsComposedChart.Line dataKey="target" isClickable />
      </EChartsComposedChart>
    ));
    const entries = [
      ...host.querySelectorAll("[style*='position: absolute'] > div"),
    ] as HTMLElement[];

    entries[1]!.click();
    expect(onSelectionChange).toHaveBeenLastCalledWith("target");
    expect(entries[0]!.className).toContain("opacity-30");
  });
});

describe("loading", () => {
  it("shows the badge and hides the legend", () => {
    const host = mount(() => (
      <EChartsComposedChart
        data={DATA}
        config={CONFIG}
        renderer="svg"
        animation={false}
        isLoading
      >
        <EChartsComposedChart.Legend />
        <EChartsComposedChart.Bar dataKey="revenue" />
      </EChartsComposedChart>
    ));
    expect(host.textContent).toContain("Loading");
    expect(host.textContent).not.toContain("Revenue");
  });
});
