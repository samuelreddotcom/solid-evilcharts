import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import type { JSX } from "solid-js";

import { EChartsLineChart } from "./line-chart";
import type { ChartConfig } from "./types";

/**
 * ECharts refuses to initialise into a zero-sized element, and jsdom reports 0
 * for every layout box. Stub the two dimensions it reads so the chart can mount;
 * nothing here depends on real layout.
 */
const originals: PropertyDescriptor[] = [];
beforeAll(() => {
  for (const [prop, value] of [
    ["clientWidth", 600],
    ["clientHeight", 320],
  ] as const) {
    const existing = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop);
    if (existing) originals.push(existing);
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get: () => value,
    });
  }
});
afterAll(() => {
  for (const descriptor of originals) {
    Object.defineProperty(
      HTMLElement.prototype,
      descriptor.get?.name.replace("get ", "") ?? "clientWidth",
      descriptor,
    );
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

/** The SVG renderer needs no 2D context, so it is the one that works in jsdom. */
const Chart = (props: {
  children?: JSX.Element;
  isLoading?: boolean;
  onSelectionChange?: (key: string | null) => void;
}) => (
  <EChartsLineChart
    data={DATA}
    config={CONFIG}
    renderer="svg"
    xDataKey="month"
    animation={false}
    isLoading={props.isLoading}
    onSelectionChange={props.onSelectionChange}
  >
    {props.children}
  </EChartsLineChart>
);

describe("mounting", () => {
  it("renders a scoped container", () => {
    const host = mount(() => (
      <Chart>
        <EChartsLineChart.Line dataKey="desktop" />
      </Chart>
    ));
    const root = host.querySelector("[data-chart]") as HTMLElement;

    expect(root).not.toBeNull();
    expect(root.getAttribute("data-chart")).toMatch(/^chart-/);
  });

  it("injects the series colour vars for both themes", () => {
    const host = mount(() => (
      <Chart>
        <EChartsLineChart.Line dataKey="desktop" />
        <EChartsLineChart.Line dataKey="mobile" />
      </Chart>
    ));
    const style = host.querySelector("style")!;
    const id = host.querySelector("[data-chart]")!.getAttribute("data-chart");

    expect(style.innerHTML).toContain(`[data-chart=${id}]`);
    expect(style.innerHTML).toContain(`.dark [data-chart=${id}]`);
    expect(style.innerHTML).toContain("--color-desktop-0: #047857;");
    expect(style.innerHTML).toContain("--color-desktop-0: #10b981;");
    expect(style.innerHTML).toContain("--color-mobile-0: #be123c;");
  });

  it("actually initialises ECharts and paints an SVG", () => {
    const host = mount(() => (
      <Chart>
        <EChartsLineChart.Line dataKey="desktop" />
      </Chart>
    ));

    const svg = host.querySelector("svg");
    expect(svg).not.toBeNull();
    // A line series draws at least one path.
    expect(svg!.querySelectorAll("path").length).toBeGreaterThan(0);
  });

  it("applies the consumer's class to the container", () => {
    const host = mount(() => (
      <EChartsLineChart
        data={DATA}
        config={CONFIG}
        renderer="svg"
        xDataKey="month"
        animation={false}
        class="h-full w-full p-4"
      >
        <EChartsLineChart.Line dataKey="desktop" />
      </EChartsLineChart>
    ));
    const root = host.querySelector("[data-chart]") as HTMLElement;
    expect(root.className).toContain("h-full w-full p-4");
    // Base classes survive too.
    expect(root.className).toContain("relative flex flex-col");
  });

  it("tears the instance down on dispose", () => {
    const host = mount(() => (
      <Chart>
        <EChartsLineChart.Line dataKey="desktop" />
      </Chart>
    ));
    expect(host.querySelector("svg")).not.toBeNull();

    disposers.pop()!();
    expect(host.querySelector("svg")).toBeNull();
  });
});

describe("legend", () => {
  it("is absent unless <Legend> is declared", () => {
    const host = mount(() => (
      <Chart>
        <EChartsLineChart.Line dataKey="desktop" />
      </Chart>
    ));
    expect(host.textContent).not.toContain("Desktop");
  });

  it("renders an entry per series when declared", () => {
    const host = mount(() => (
      <Chart>
        <EChartsLineChart.Legend />
        <EChartsLineChart.Line dataKey="desktop" />
        <EChartsLineChart.Line dataKey="mobile" />
      </Chart>
    ));
    expect(host.textContent).toContain("Desktop");
    expect(host.textContent).toContain("Mobile");
  });

  it("toggles selection on click and reports it", () => {
    const onSelectionChange = vi.fn();
    const host = mount(() => (
      <Chart onSelectionChange={onSelectionChange}>
        <EChartsLineChart.Legend isClickable />
        <EChartsLineChart.Line dataKey="desktop" isClickable />
        <EChartsLineChart.Line dataKey="mobile" isClickable />
      </Chart>
    ));

    const entries = [
      ...host.querySelectorAll("[style*='position: absolute'] > div"),
    ] as HTMLElement[];
    expect(entries.length).toBe(2);

    entries[0]!.click();
    expect(onSelectionChange).toHaveBeenLastCalledWith("desktop");

    // Clicking the same entry again clears the selection.
    entries[0]!.click();
    expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  });

  it("dims unselected entries once a selection stands", () => {
    const host = mount(() => (
      <Chart>
        <EChartsLineChart.Legend isClickable />
        <EChartsLineChart.Line dataKey="desktop" isClickable />
        <EChartsLineChart.Line dataKey="mobile" isClickable />
      </Chart>
    ));

    const entries = [
      ...host.querySelectorAll("[style*='position: absolute'] > div"),
    ] as HTMLElement[];
    entries[0]!.click();

    expect(entries[0]!.className).not.toContain("opacity-30");
    expect(entries[1]!.className).toContain("opacity-30");
  });
});

describe("loading", () => {
  it("shows the badge and hides the legend", () => {
    const host = mount(() => (
      <Chart isLoading>
        <EChartsLineChart.Legend />
        <EChartsLineChart.Line dataKey="desktop" />
      </Chart>
    ));

    expect(host.textContent).toContain("Loading");
    expect(host.textContent).not.toContain("Desktop");
  });

  it("hides the badge once loading clears", () => {
    const host = mount(() => (
      <Chart>
        <EChartsLineChart.Line dataKey="desktop" />
      </Chart>
    ));
    expect(host.textContent).not.toContain("Loading");
  });
});

describe("declarative config reaches the chart", () => {
  it("renders axis labels only when <XAxis> is declared", () => {
    const without = mount(() => (
      <Chart>
        <EChartsLineChart.Line dataKey="desktop" />
      </Chart>
    ));
    expect(without.querySelector("svg")!.textContent).not.toContain("January");

    const with_ = mount(() => (
      <Chart>
        <EChartsLineChart.XAxis dataKey="month" />
        <EChartsLineChart.Line dataKey="desktop" />
      </Chart>
    ));
    expect(with_.querySelector("svg")!.textContent).toContain("January");
  });

  it("applies an x tick formatter", () => {
    const host = mount(() => (
      <Chart>
        <EChartsLineChart.XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
        <EChartsLineChart.Line dataKey="desktop" />
      </Chart>
    ));
    const text = host.querySelector("svg")!.textContent ?? "";
    expect(text).toContain("Jan");
    expect(text).not.toContain("January");
  });

  it("draws one path per line, plus more when a buffer tail is on", () => {
    const plain = mount(() => (
      <Chart>
        <EChartsLineChart.Line dataKey="desktop" />
      </Chart>
    ));
    const buffered = mount(() => (
      <Chart>
        <EChartsLineChart.Line dataKey="desktop" enableBufferLine />
      </Chart>
    ));

    const count = (host: HTMLElement) =>
      host.querySelector("svg")!.querySelectorAll("path").length;
    expect(count(buffered)).toBeGreaterThan(count(plain));
  });
});
