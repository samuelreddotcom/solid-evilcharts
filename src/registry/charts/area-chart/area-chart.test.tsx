import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { createSignal, type JSX } from "solid-js";

import { EChartsAreaChart } from "./area-chart";
import type { ChartConfig } from "./types";

// ECharts refuses to initialise into a zero-sized element and jsdom reports 0
// for every layout box.
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
  { month: "January", desktop: 342, mobile: 245 },
  { month: "February", desktop: 876, mobile: 654 },
  { month: "March", desktop: 512, mobile: 387 },
];

const CONFIG: ChartConfig = {
  desktop: { label: "Desktop", colors: { light: ["#047857"], dark: ["#10b981"] } },
  mobile: { label: "Mobile", colors: { light: ["#be123c"], dark: ["#f43f5e"] } },
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

const legendEntries = (host: HTMLElement) =>
  [...host.querySelectorAll("[style*='position: absolute'] > div")] as HTMLElement[];

describe("mounting", () => {
  it("initialises ECharts and paints an SVG", () => {
    const host = mount(() => (
      <EChartsAreaChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
        <EChartsAreaChart.Area dataKey="desktop" />
      </EChartsAreaChart>
    ));

    const svg = host.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("injects the colour vars for both themes", () => {
    const host = mount(() => (
      <EChartsAreaChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
        <EChartsAreaChart.Area dataKey="desktop" />
      </EChartsAreaChart>
    ));
    const style = host.querySelector("style")!;
    expect(style.innerHTML).toContain("--color-desktop-0: #047857;");
    expect(style.innerHTML).toContain("--color-desktop-0: #10b981;");
  });

  it("draws more paths than a bare line, because each area adds a filled polygon", () => {
    const host = mount(() => (
      <EChartsAreaChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
        <EChartsAreaChart.Area dataKey="desktop" />
        <EChartsAreaChart.Area dataKey="mobile" />
      </EChartsAreaChart>
    ));
    // Two areas → at least two strokes plus two fills.
    expect(host.querySelector("svg")!.querySelectorAll("path").length).toBeGreaterThanOrEqual(4);
  });

  it("tears down on dispose", () => {
    const host = mount(() => (
      <EChartsAreaChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
        <EChartsAreaChart.Area dataKey="desktop" />
      </EChartsAreaChart>
    ));
    expect(host.querySelector("svg")).not.toBeNull();
    disposers.pop()!();
    expect(host.querySelector("svg")).toBeNull();
  });
});

describe("stacking", () => {
  it("renders under every stackType without throwing", () => {
    for (const stackType of ["default", "stacked", "expanded"] as const) {
      const host = mount(() => (
        <EChartsAreaChart
          data={DATA}
          config={CONFIG}
          renderer="svg"
          animation={false}
          stackType={stackType}
        >
          <EChartsAreaChart.Area dataKey="desktop" />
          <EChartsAreaChart.Area dataKey="mobile" />
        </EChartsAreaChart>
      ));
      expect(host.querySelector("svg"), stackType).not.toBeNull();
    }
  });

  it("survives a live stackType change", () => {
    const [stackType, setStackType] = createSignal<"default" | "stacked">("default");
    const host = mount(() => (
      <EChartsAreaChart
        data={DATA}
        config={CONFIG}
        renderer="svg"
        animation={false}
        stackType={stackType()}
      >
        <EChartsAreaChart.Area dataKey="desktop" />
        <EChartsAreaChart.Area dataKey="mobile" />
      </EChartsAreaChart>
    ));

    expect(host.querySelector("svg")).not.toBeNull();
    setStackType("stacked");
    expect(host.querySelector("svg")).not.toBeNull();
  });
});

describe("selection", () => {
  it("toggles and reports when uncontrolled", () => {
    const onSelectionChange = vi.fn();
    const host = mount(() => (
      <EChartsAreaChart
        data={DATA}
        config={CONFIG}
        renderer="svg"
        animation={false}
        onSelectionChange={onSelectionChange}
      >
        <EChartsAreaChart.Legend isClickable />
        <EChartsAreaChart.Area dataKey="desktop" isClickable />
        <EChartsAreaChart.Area dataKey="mobile" isClickable />
      </EChartsAreaChart>
    ));

    const entries = legendEntries(host);
    entries[0]!.click();
    expect(onSelectionChange).toHaveBeenLastCalledWith("desktop");
    expect(entries[1]!.className).toContain("opacity-30");

    entries[0]!.click();
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });

  it("honours a controlled selectedDataKey and ignores internal toggles", () => {
    const onSelectionChange = vi.fn();
    const host = mount(() => (
      <EChartsAreaChart
        data={DATA}
        config={CONFIG}
        renderer="svg"
        animation={false}
        selectedDataKey="mobile"
        onSelectionChange={onSelectionChange}
      >
        <EChartsAreaChart.Legend isClickable />
        <EChartsAreaChart.Area dataKey="desktop" isClickable />
        <EChartsAreaChart.Area dataKey="mobile" isClickable />
      </EChartsAreaChart>
    ));

    const entries = legendEntries(host);
    // Controlled to "mobile": desktop is the dimmed one.
    expect(entries[0]!.className).toContain("opacity-30");
    expect(entries[1]!.className).not.toContain("opacity-30");

    // A click still reports, but the rendered selection does not move.
    entries[0]!.click();
    expect(onSelectionChange).toHaveBeenLastCalledWith("desktop");
    expect(entries[0]!.className).toContain("opacity-30");
  });

  it("follows a controlled value as it changes", () => {
    const [selected, setSelected] = createSignal<string | null>("desktop");
    const host = mount(() => (
      <EChartsAreaChart
        data={DATA}
        config={CONFIG}
        renderer="svg"
        animation={false}
        selectedDataKey={selected()}
      >
        <EChartsAreaChart.Legend />
        <EChartsAreaChart.Area dataKey="desktop" />
        <EChartsAreaChart.Area dataKey="mobile" />
      </EChartsAreaChart>
    ));

    expect(legendEntries(host)[1]!.className).toContain("opacity-30");
    setSelected("mobile");
    expect(legendEntries(host)[0]!.className).toContain("opacity-30");
    setSelected(null);
    expect(legendEntries(host)[0]!.className).not.toContain("opacity-30");
  });

  it("seeds from defaultSelectedDataKey when uncontrolled", () => {
    const host = mount(() => (
      <EChartsAreaChart
        data={DATA}
        config={CONFIG}
        renderer="svg"
        animation={false}
        defaultSelectedDataKey="desktop"
      >
        <EChartsAreaChart.Legend />
        <EChartsAreaChart.Area dataKey="desktop" />
        <EChartsAreaChart.Area dataKey="mobile" />
      </EChartsAreaChart>
    ));
    expect(legendEntries(host)[1]!.className).toContain("opacity-30");
  });
});

describe("fill variants", () => {
  it("renders every variant without throwing", () => {
    for (const variant of [
      "gradient",
      "gradient-reverse",
      "solid",
      "dotted",
      "lines",
      "hatched",
      "none",
    ] as const) {
      const host = mount(() => (
        <EChartsAreaChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
          <EChartsAreaChart.Area dataKey="desktop" variant={variant} />
        </EChartsAreaChart>
      ));
      expect(host.querySelector("svg"), variant).not.toBeNull();
    }
  });
});

describe("loading", () => {
  it("shows the badge and hides the legend", () => {
    const host = mount(() => (
      <EChartsAreaChart data={DATA} config={CONFIG} renderer="svg" animation={false} isLoading>
        <EChartsAreaChart.Legend />
        <EChartsAreaChart.Area dataKey="desktop" />
      </EChartsAreaChart>
    ));
    expect(host.textContent).toContain("Loading");
    expect(host.textContent).not.toContain("Desktop");
  });
});
