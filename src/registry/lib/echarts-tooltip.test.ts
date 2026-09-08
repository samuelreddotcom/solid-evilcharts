import { describe, expect, it } from "vitest";

import type { ResolvedColors } from "./chart-tokens";
import {
  resolveTooltipPosition,
  roundnessClass,
  tooltipBaseOption,
  tooltipIndicatorHtml,
  tooltipRow,
  tooltipShell,
  tooltipVariantClass,
} from "./echarts-tooltip";

const TOKENS: ResolvedColors["tokens"] = {
  mutedForeground: "rgba(100, 100, 100, 1)",
  border: "rgba(200, 200, 200, 1)",
  foreground: "rgba(0, 0, 0, 1)",
  background: "rgba(255, 255, 255, 1)",
};

describe("tooltipIndicatorHtml", () => {
  it("uses a bare var for a single-colour series", () => {
    expect(tooltipIndicatorHtml("desktop", 1)).toContain(
      "background:var(--color-desktop-0)",
    );
  });

  it("uses a gradient for a multi-colour series", () => {
    const html = tooltipIndicatorHtml("desktop", 3);
    expect(html).toContain("linear-gradient(to right");
    expect(html).toContain("var(--color-desktop-2) 100%");
  });
});

describe("tooltipRow", () => {
  const row = (dimmed: string) =>
    tooltipRow({
      indicatorHtml: "<i></i>",
      labelText: "Desktop",
      valueText: "342",
      dimmed,
    });

  it("renders label and value", () => {
    expect(row("")).toContain("Desktop");
    expect(row("")).toContain("342");
    expect(row("")).toContain("<i></i>");
  });

  it("appends the dim fragment directly onto the row's class list", () => {
    // `dimmed` is a raw class fragment, so it must concatenate with no space of
    // its own — the caller supplies the leading space.
    expect(row(" opacity-30")).toContain('items-center gap-2 opacity-30"');
    expect(row("")).toContain('items-center gap-2"');
  });
});

describe("tooltipShell", () => {
  it("applies the roundness and variant classes", () => {
    const html = tooltipShell({
      label: "January",
      body: "<rows/>",
      roundness: "xl",
      variant: "frosted-glass",
    });

    expect(html).toContain(roundnessClass.xl);
    expect(html).toContain(tooltipVariantClass["frosted-glass"]);
    expect(html).toContain("January");
    expect(html).toContain("<rows/>");
  });

  it("covers every roundness and variant", () => {
    expect(Object.keys(roundnessClass)).toEqual(["sm", "md", "lg", "xl"]);
    expect(Object.keys(tooltipVariantClass)).toEqual(["default", "frosted-glass"]);
  });
});

describe("resolveTooltipPosition", () => {
  it("returns undefined for variable — ECharts' own follow-both-axes default", () => {
    expect(resolveTooltipPosition("variable")).toBeUndefined();
  });

  it("centres on the pointer X and pins Y for fixed", () => {
    const position = resolveTooltipPosition("fixed");
    expect(typeof position).toBe("function");

    const fn = position as (
      point: number[],
      params: unknown,
      dom: unknown,
      rect: unknown,
      size: { contentSize: number[] },
    ) => number[];

    // Pointer at x=200, tooltip 80 wide → left edge at 160, y pinned to 8.
    expect(fn([200, 999], null, null, null, { contentSize: [80, 40] })).toEqual([160, 8]);
  });
});

describe("tooltipBaseOption", () => {
  const base = (overrides: Partial<Parameters<typeof tooltipBaseOption>[0]> = {}) =>
    tooltipBaseOption({
      present: true,
      cursor: true,
      tokens: TOKENS,
      position: "variable",
      axisPointerColor: "rgba(1, 2, 3, 0.5)",
      strokeWidth: 0.8,
      ...overrides,
    });

  it("renders a transparent host so the HTML shell supplies all chrome", () => {
    const option = base();
    expect(option.backgroundColor).toBe("transparent");
    expect(option.borderWidth).toBe(0);
    expect(option.padding).toBe(0);
    expect(option.extraCssText).toBe("box-shadow:none;");
  });

  it("confines to the chart and triggers on axis", () => {
    const option = base();
    expect(option.confine).toBe(true);
    expect(option.trigger).toBe("axis");
  });

  it("threads present through to show", () => {
    expect(base({ present: false }).show).toBe(false);
    expect(base({ present: true }).show).toBe(true);
  });

  it("draws a dashed cursor line using the pre-resolved colour", () => {
    const option = base();
    expect(option.axisPointer).toEqual({
      type: "line",
      lineStyle: {
        color: "rgba(1, 2, 3, 0.5)",
        width: 0.8,
        type: [3, 3],
      },
    });
  });

  it("disables the cursor entirely when cursor is false", () => {
    expect(base({ cursor: false }).axisPointer).toEqual({ type: "none" });
  });

  it("wires position through resolveTooltipPosition", () => {
    expect(base({ position: "variable" }).position).toBeUndefined();
    expect(typeof base({ position: "fixed" }).position).toBe("function");
  });
});
