import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import type { JSX } from "solid-js";

import {
  LegendIndicator,
  LegendOverlay,
  legendFillStyle,
  legendOutlineStyle,
  type LegendVariant,
} from "./echarts-legend";
import type { ChartConfig } from "./chart-tokens";

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

/**
 * The porting hazard this file exists for.
 *
 * Solid applies a style object via element.style.setProperty(), which takes CSS
 * property names verbatim. React's camelCase keys (`backgroundColor`,
 * `WebkitMaskComposite`) are silently dropped — no error, no warning, the style
 * simply never lands. Asserting on the rendered element rather than the object
 * is the only way to catch a regression to camelCase.
 */
describe("style keys reach the DOM (kebab-case, not camelCase)", () => {
  it("applies a single-colour fill as an actual inline style", () => {
    const host = mount(() => (
      <LegendIndicator variant="square" dataKey="desktop" colorsCount={1} />
    ));
    const el = host.firstElementChild as HTMLElement;

    expect(el.style.backgroundColor).toBe("var(--color-desktop-0)");
    expect(el.getAttribute("style")).toContain("background-color");
  });

  it("applies a gradient fill as an actual inline style", () => {
    const host = mount(() => (
      <LegendIndicator variant="rounded-square" dataKey="mobile" colorsCount={3} />
    ));
    const el = host.firstElementChild as HTMLElement;

    expect(el.getAttribute("style")).toContain("linear-gradient");
    expect(el.getAttribute("style")).toContain("var(--color-mobile-0) 0%");
    expect(el.getAttribute("style")).toContain("var(--color-mobile-2) 100%");
  });

  it("emits mask properties for outline variants", () => {
    const host = mount(() => (
      <LegendIndicator variant="circle-outline" dataKey="desktop" colorsCount={1} />
    ));
    const style = (host.firstElementChild as HTMLElement).getAttribute("style") ?? "";

    // jsdom drops properties it doesn't recognise, so assert on the ones it
    // keeps and on the absence of camelCase leakage.
    expect(style).toContain("mask");
    expect(style).not.toContain("WebkitMask");
    expect(style).not.toContain("maskComposite");
  });

  it("declares every style key in kebab-case", () => {
    for (const style of [
      legendFillStyle("k", 1),
      legendFillStyle("k", 3),
      legendOutlineStyle("k", 1),
      legendOutlineStyle("k", 3),
    ]) {
      for (const key of Object.keys(style)) {
        expect(key, `"${key}" must be kebab-case`).not.toMatch(/[A-Z]/);
      }
    }
  });
});

describe("LegendIndicator variants", () => {
  const variants: LegendVariant[] = [
    "square",
    "circle",
    "circle-outline",
    "rounded-square",
    "rounded-square-outline",
    "vertical-bar",
    "horizontal-bar",
  ];

  it.each(variants)("%s renders a styled element", (variant) => {
    const host = mount(() => (
      <LegendIndicator variant={variant} dataKey="desktop" colorsCount={1} />
    ));
    const el = host.firstElementChild as HTMLElement;

    expect(el).not.toBeNull();
    expect(el.className).toContain("shrink-0");
    expect(el.getAttribute("style")).toBeTruthy();
  });

  it("distinguishes outline variants by their padding class", () => {
    const outline = mount(() => (
      <LegendIndicator variant="circle-outline" dataKey="d" colorsCount={1} />
    ));
    const solid = mount(() => (
      <LegendIndicator variant="circle" dataKey="d" colorsCount={1} />
    ));

    expect((outline.firstElementChild as HTMLElement).className).toContain("p-[1.5px]");
    expect((solid.firstElementChild as HTMLElement).className).not.toContain("p-[");
  });
});

describe("LegendOverlay", () => {
  const config: ChartConfig = {
    desktop: { label: "Desktop", colors: { light: ["#0a0"] } },
    mobile: { label: "Mobile", colors: { light: ["#a00", "#f00"] } },
  };

  const base = {
    config,
    variant: "rounded-square" as const,
    align: "right" as const,
    verticalAlign: "top" as const,
    selectedKey: null,
    hoveredKey: null,
    isClickable: false,
    onToggle: () => {},
    style: {} as JSX.CSSProperties,
  };

  it("renders one entry per series key, with labels", () => {
    const host = mount(() => (
      <LegendOverlay {...base} seriesKeys={["desktop", "mobile"]} />
    ));

    expect(host.textContent).toContain("Desktop");
    expect(host.textContent).toContain("Mobile");
    expect(host.firstElementChild!.childElementCount).toBe(2);
  });

  it("maps align onto the justify class", () => {
    const left = mount(() => (
      <LegendOverlay {...base} align="left" seriesKeys={["desktop"]} />
    ));
    const center = mount(() => (
      <LegendOverlay {...base} align="center" seriesKeys={["desktop"]} />
    ));
    const right = mount(() => (
      <LegendOverlay {...base} align="right" seriesKeys={["desktop"]} />
    ));

    expect(left.firstElementChild!.className).toContain("justify-start");
    expect(center.firstElementChild!.className).toContain("justify-center");
    expect(right.firstElementChild!.className).toContain("justify-end");
  });

  it("dims entries that are neither selected nor hovered", () => {
    const host = mount(() => (
      <LegendOverlay {...base} selectedKey="desktop" seriesKeys={["desktop", "mobile"]} />
    ));
    const [first, second] = [...host.firstElementChild!.children] as HTMLElement[];

    expect(first!.className).not.toContain("opacity-30");
    expect(second!.className).toContain("opacity-30");
  });

  it("dims on hover of another series too", () => {
    const host = mount(() => (
      <LegendOverlay {...base} hoveredKey="mobile" seriesKeys={["desktop", "mobile"]} />
    ));
    const [first, second] = [...host.firstElementChild!.children] as HTMLElement[];

    expect(first!.className).toContain("opacity-30");
    expect(second!.className).not.toContain("opacity-30");
  });

  it("fires onToggle only when clickable", () => {
    const onToggle = vi.fn();

    const inert = mount(() => (
      <LegendOverlay {...base} onToggle={onToggle} seriesKeys={["desktop"]} />
    ));
    (inert.firstElementChild!.firstElementChild as HTMLElement).click();
    expect(onToggle).not.toHaveBeenCalled();

    const clickable = mount(() => (
      <LegendOverlay
        {...base}
        isClickable
        onToggle={onToggle}
        seriesKeys={["desktop"]}
      />
    ));
    const entry = clickable.firstElementChild!.firstElementChild as HTMLElement;
    expect(entry.className).toContain("cursor-pointer");
    entry.click();
    expect(onToggle).toHaveBeenCalledWith("desktop");
  });

  it("applies the positioning style the chart passes in", () => {
    const host = mount(() => (
      <LegendOverlay
        {...base}
        seriesKeys={["desktop"]}
        style={{ position: "absolute", top: "4px" }}
      />
    ));
    const el = host.firstElementChild as HTMLElement;

    expect(el.style.position).toBe("absolute");
    expect(el.style.top).toBe("4px");
  });
});
