import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetDevWarnings,
  warnCanvasOnlyVariants,
  warnMissingNodeLabelPosition,
  warnUnconfiguredKeys,
} from "./dev-warn";

/**
 * These warnings exist because each failure mode they cover renders a chart
 * that looks healthy and is simply wrong. The tests that matter most here are
 * the NEGATIVE ones: a warning that cries wolf gets muted, and then it is worth
 * less than no warning at all.
 */

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetDevWarnings();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

const message = () => String(warn.mock.calls[0]?.[0] ?? "");

describe("warnUnconfiguredKeys", () => {
  it("warns when a series key has no config entry", () => {
    warnUnconfiguredKeys(["Chrome"], { desktop: {} });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(message()).toContain('"Chrome"');
  });

  it("names both key sets, which is what reveals the pie/radial mix-up", () => {
    // The actual mistake this catches: config keyed by series column while the
    // chart asks by sector name. Printing one set without the other leaves the
    // reader to guess which convention this chart wanted.
    warnUnconfiguredKeys(["Chrome", "Safari"], { desktop: {}, mobile: {} });

    expect(message()).toContain("desktop, mobile");
    expect(message()).toContain("Chrome, Safari");
  });

  it("stays silent when the key exists but declares no colours", () => {
    // `{ desktop: {} }` is legitimate — a label-only entry. It resolves to grey
    // exactly like a missing key does, which is why the check is written
    // against config membership and NOT against the resolved colour.
    warnUnconfiguredKeys(["desktop"], { desktop: {} });

    expect(warn).not.toHaveBeenCalled();
  });

  it("stays silent for an empty chart", () => {
    warnUnconfiguredKeys([], {});

    expect(warn).not.toHaveBeenCalled();
  });

  it("warns once, not once per reactive re-render", () => {
    // resolveColors runs on every theme change and every re-measure. Without
    // the dedupe this floods the console and buries the first occurrence.
    for (let i = 0; i < 5; i++) warnUnconfiguredKeys(["Chrome"], { desktop: {} });

    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("warnCanvasOnlyVariants", () => {
  const CANVAS_ONLY = ["dotted", "lines", "hatched"] as const;

  it("warns for a canvas-only variant under the svg renderer", () => {
    warnCanvasOnlyVariants("Area chart", "svg", ["hatched"], CANVAS_ONLY);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(message()).toContain('"hatched"');
    expect(message()).toContain("Area chart");
  });

  it("stays silent under the canvas renderer, where the fill works", () => {
    warnCanvasOnlyVariants("Area chart", "canvas", ["hatched"], CANVAS_ONLY);

    expect(warn).not.toHaveBeenCalled();
  });

  it("stays silent for a variant that renders fine under svg", () => {
    warnCanvasOnlyVariants("Area chart", "svg", ["gradient", "solid"], CANVAS_ONLY);

    expect(warn).not.toHaveBeenCalled();
  });

  it("reports each affected variant once, however many series use it", () => {
    warnCanvasOnlyVariants("Area chart", "svg", ["hatched", "hatched", "dotted"], CANVAS_ONLY);

    const text = message();
    expect(text.match(/"hatched"/g)).toHaveLength(1);
    expect(text).toContain('"dotted"');
  });
});

describe("warnMissingNodeLabelPosition", () => {
  it("names the prop and gives a usable value", () => {
    warnMissingNodeLabelPosition();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(message()).toContain("position");
  });
});
