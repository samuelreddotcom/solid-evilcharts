import { describe, expect, it } from "vitest";
import { For, children, createMemo, createRoot, createSignal } from "solid-js";

import { ActiveDot, Area, Brush, Dot, Grid, Legend, Tooltip, XAxis, collectConfig } from "./parts";

function collect(ui: () => unknown) {
  return createRoot((dispose) => {
    try {
      return collectConfig(children(() => ui() as never)());
    } finally {
      dispose();
    }
  });
}

describe("collectConfig — area defaults", () => {
  it("defaults an <Area> to a DASHED stroke", () => {
    // Deliberate upstream divergence: <Line> defaults to solid, <Area> to
    // dashed. Easy to "correct" into a bug when porting the two side by side.
    expect(collect(() => <Area dataKey="desktop" />).areas[0]!.strokeVariant).toBe("dashed");
  });

  it("defaults the fill to gradient", () => {
    expect(collect(() => <Area dataKey="desktop" />).areas[0]!.variant).toBe("gradient");
  });

  it("applies the remaining documented defaults", () => {
    expect(collect(() => <Area dataKey="desktop" />).areas[0]).toMatchObject({
      strokeWidth: 0.8,
      connectNulls: false,
      isClickable: false,
      enableBufferLine: false,
      dotVariant: "none",
      activeDotVariant: "none",
    });
  });

  it("carries every explicit prop through", () => {
    const collected = collect(() => (
      <Area
        dataKey="desktop"
        variant="hatched"
        strokeVariant="animated-dashed"
        strokeWidth={2}
        curveType="step"
        connectNulls
        isClickable
        enableBufferLine
      />
    ));
    expect(collected.areas[0]).toMatchObject({
      variant: "hatched",
      strokeVariant: "animated-dashed",
      strokeWidth: 2,
      curveType: "step",
      connectNulls: true,
      isClickable: true,
      enableBufferLine: true,
    });
  });
});

describe("collectConfig — nested dots", () => {
  it("reads <Dot> and <ActiveDot> out of a non-rendering <Area>", () => {
    const collected = collect(() => (
      <Area dataKey="desktop">
        <Dot variant="border" />
        <ActiveDot variant="colored-border" />
      </Area>
    ));
    expect(collected.areas[0]!.dotVariant).toBe("border");
    expect(collected.areas[0]!.activeDotVariant).toBe("colored-border");
  });

  it("keeps each area's dots to itself", () => {
    const collected = collect(() => (
      <>
        <Area dataKey="desktop">
          <Dot variant="ping" />
        </Area>
        <Area dataKey="mobile" />
      </>
    ));
    expect(collected.areas[0]!.dotVariant).toBe("ping");
    expect(collected.areas[1]!.dotVariant).toBe("none");
  });
});

describe("collectConfig — slots and control flow", () => {
  it("turns each slot on by presence", () => {
    const collected = collect(() => (
      <>
        <Grid />
        <XAxis dataKey="month" />
        <Tooltip />
        <Legend />
        <Brush height={72} />
      </>
    ));
    expect(collected.showGrid).toBe(true);
    expect(collected.xAxis.dataKey).toBe("month");
    expect(collected.tooltip.present).toBe(true);
    expect(collected.legend.present).toBe(true);
    expect(collected.brush.height).toBe(72);
  });

  it("reacts to a <For> over areas", () => {
    createRoot((dispose) => {
      const [keys, setKeys] = createSignal(["desktop", "mobile"]);
      const resolved = children(() => <For each={keys()}>{(k) => <Area dataKey={k} />}</For>);
      const collected = createMemo(() => collectConfig(resolved()));

      expect(collected().areas.map((a) => a.dataKey)).toEqual(["desktop", "mobile"]);
      setKeys(["tablet"]);
      expect(collected().areas.map((a) => a.dataKey)).toEqual(["tablet"]);
      dispose();
    });
  });

  it("re-collects when a marker prop changes", () => {
    createRoot((dispose) => {
      const [variant, setVariant] = createSignal<"gradient" | "hatched">("gradient");
      const resolved = children(() => <Area dataKey="desktop" variant={variant()} />);
      const collected = createMemo(() => collectConfig(resolved()));

      expect(collected().areas[0]!.variant).toBe("gradient");
      setVariant("hatched");
      expect(collected().areas[0]!.variant).toBe("hatched");
      dispose();
    });
  });
});
