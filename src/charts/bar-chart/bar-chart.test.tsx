import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { createSignal, type JSX } from "solid-js";

import { EChartsBarChart } from "./bar-chart";
import { collectConfig } from "./parts";
import type { BarVariant, ChartConfig } from "./types";

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

describe("collectConfig", () => {
  it("defaults a <Bar> to the default variant and no opt-ins", () => {
    const collected = collectConfig(
      (<EChartsBarChart.Bar dataKey="desktop" />) as unknown,
    );
    expect(collected.bars[0]).toMatchObject({
      variant: "default",
      isClickable: false,
      enableHoverHighlight: false,
      glowing: false,
      bufferBar: false,
    });
  });

  it("collects both axes into the same shape, whatever the layout", () => {
    const collected = collectConfig(
      (
        <>
          <EChartsBarChart.XAxis dataKey="month" label="Month" />
          <EChartsBarChart.YAxis hideDots />
        </>
      ) as unknown,
    );
    expect(collected.xAxis).toMatchObject({ present: true, dataKey: "month", label: "Month" });
    expect(collected.yAxis).toMatchObject({ present: true, hideDots: true });
  });

  it("carries the tooltip's defaultIndex", () => {
    const collected = collectConfig(
      (<EChartsBarChart.Tooltip defaultIndex={2} />) as unknown,
    );
    expect(collected.tooltip.defaultIndex).toBe(2);
  });
});

describe("mounting", () => {
  it("initialises ECharts and paints an SVG", () => {
    const host = mount(() => (
      <EChartsBarChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
        <EChartsBarChart.Bar dataKey="desktop" />
      </EChartsBarChart>
    ));
    const svg = host.querySelector("svg");
    expect(svg).not.toBeNull();
    // Three bars → three rects, plus whatever chrome ECharts adds.
    expect(svg!.querySelectorAll("path, rect").length).toBeGreaterThanOrEqual(3);
  });

  it("injects the colour vars for both themes", () => {
    const host = mount(() => (
      <EChartsBarChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
        <EChartsBarChart.Bar dataKey="desktop" />
      </EChartsBarChart>
    ));
    const style = host.querySelector("style")!;
    expect(style.innerHTML).toContain("--color-desktop-0: #047857;");
    expect(style.innerHTML).toContain("--color-desktop-0: #10b981;");
  });

  it("tears down on dispose", () => {
    const host = mount(() => (
      <EChartsBarChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
        <EChartsBarChart.Bar dataKey="desktop" />
      </EChartsBarChart>
    ));
    expect(host.querySelector("svg")).not.toBeNull();
    disposers.pop()!();
    expect(host.querySelector("svg")).toBeNull();
  });
});

describe("variants and layout", () => {
  const VARIANTS: BarVariant[] = [
    "default",
    "hatched",
    "duotone",
    "duotone-reverse",
    "gradient",
    "stripped",
    "blocks",
    "expandable",
  ];

  it("renders every variant without throwing", () => {
    for (const variant of VARIANTS) {
      const host = mount(() => (
        <EChartsBarChart data={DATA} config={CONFIG} renderer="svg" animation={false}>
          <EChartsBarChart.Bar dataKey="desktop" variant={variant} />
        </EChartsBarChart>
      ));
      expect(host.querySelector("svg"), variant).not.toBeNull();
    }
  });

  it("renders both layouts", () => {
    for (const layout of ["vertical", "horizontal"] as const) {
      const host = mount(() => (
        <EChartsBarChart
          data={DATA}
          config={CONFIG}
          renderer="svg"
          animation={false}
          layout={layout}
        >
          <EChartsBarChart.XAxis dataKey="month" />
          <EChartsBarChart.YAxis />
          <EChartsBarChart.Bar dataKey="desktop" />
        </EChartsBarChart>
      ));
      expect(host.querySelector("svg"), layout).not.toBeNull();
    }
  });

  it("survives a live layout switch", () => {
    const [layout, setLayout] = createSignal<"vertical" | "horizontal">("vertical");
    const host = mount(() => (
      <EChartsBarChart
        data={DATA}
        config={CONFIG}
        renderer="svg"
        animation={false}
        layout={layout()}
      >
        <EChartsBarChart.Bar dataKey="desktop" />
      </EChartsBarChart>
    ));
    expect(host.querySelector("svg")).not.toBeNull();
    setLayout("horizontal");
    expect(host.querySelector("svg")).not.toBeNull();
  });

  it("renders every stackType", () => {
    for (const stackType of ["default", "stacked", "percent"] as const) {
      const host = mount(() => (
        <EChartsBarChart
          data={DATA}
          config={CONFIG}
          renderer="svg"
          animation={false}
          stackType={stackType}
        >
          <EChartsBarChart.Bar dataKey="desktop" />
          <EChartsBarChart.Bar dataKey="mobile" />
        </EChartsBarChart>
      ));
      expect(host.querySelector("svg"), stackType).not.toBeNull();
    }
  });
});

describe("selection", () => {
  it("toggles and reports from the legend", () => {
    const onSelectionChange = vi.fn();
    const host = mount(() => (
      <EChartsBarChart
        data={DATA}
        config={CONFIG}
        renderer="svg"
        animation={false}
        onSelectionChange={onSelectionChange}
      >
        <EChartsBarChart.Legend isClickable />
        <EChartsBarChart.Bar dataKey="desktop" isClickable />
        <EChartsBarChart.Bar dataKey="mobile" isClickable />
      </EChartsBarChart>
    ));

    const entries = legendEntries(host);
    entries[0]!.click();
    expect(onSelectionChange).toHaveBeenLastCalledWith("desktop");
    expect(entries[1]!.className).toContain("opacity-30");

    entries[0]!.click();
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });
});

describe("max value highlight", () => {
  it("renders without throwing and keeps the legend intact", () => {
    const host = mount(() => (
      <EChartsBarChart
        data={DATA}
        config={CONFIG}
        renderer="svg"
        animation={false}
        enableMaxValueHighlight
      >
        <EChartsBarChart.Legend />
        <EChartsBarChart.Bar dataKey="desktop" />
      </EChartsBarChart>
    ));
    expect(host.querySelector("svg")).not.toBeNull();
    expect(host.textContent).toContain("Desktop");
  });
});

describe("loading", () => {
  it("shows the badge and hides the legend", () => {
    const host = mount(() => (
      <EChartsBarChart data={DATA} config={CONFIG} renderer="svg" animation={false} isLoading>
        <EChartsBarChart.Legend />
        <EChartsBarChart.Bar dataKey="desktop" />
      </EChartsBarChart>
    ));
    expect(host.textContent).toContain("Loading");
    expect(host.textContent).not.toContain("Desktop");
  });
});
