import { describe, expect, it } from "vitest";
import { For, Show, children, createRoot, createSignal, createMemo } from "solid-js";

import {
  ActiveDot,
  Brush,
  Dot,
  Grid,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
  collectConfig,
} from "./parts";

function inRoot<T>(body: () => T): T {
  return createRoot((dispose) => {
    try {
      return body();
    } finally {
      dispose();
    }
  });
}

const collect = (ui: () => unknown) =>
  inRoot(() => collectConfig(children(() => ui() as never)()));

describe("collectConfig — lines", () => {
  it("collects one entry per <Line>, in order", () => {
    const config = collect(() => (
      <>
        <Line dataKey="desktop" />
        <Line dataKey="mobile" />
      </>
    ));
    expect(config.lines.map((l) => l.dataKey)).toEqual(["desktop", "mobile"]);
  });

  it("defaults a <Line> to a SOLID stroke", () => {
    // Deliberate divergence preserved from upstream: <Area> defaults to dashed,
    // <Line> to solid.
    expect(collect(() => <Line dataKey="desktop" />).lines[0]!.strokeVariant).toBe("solid");
  });

  it("applies the documented defaults", () => {
    const line = collect(() => <Line dataKey="desktop" />).lines[0]!;
    expect(line).toMatchObject({
      strokeWidth: 0.8,
      connectNulls: false,
      isClickable: false,
      glowing: false,
      enableBufferLine: false,
      dotVariant: "none",
      activeDotVariant: "none",
    });
  });

  it("carries through every explicit prop", () => {
    const line = collect(() => (
      <Line
        dataKey="desktop"
        strokeVariant="animated-dashed"
        strokeWidth={3}
        curveType="step"
        animationType="edges-in"
        connectNulls
        isClickable
        glowing
        enableBufferLine
      />
    )).lines[0]!;

    expect(line).toMatchObject({
      strokeVariant: "animated-dashed",
      strokeWidth: 3,
      curveType: "step",
      animationType: "edges-in",
      connectNulls: true,
      isClickable: true,
      glowing: true,
      enableBufferLine: true,
    });
  });
});

describe("collectConfig — nested dots", () => {
  it("reads <Dot> and <ActiveDot> out of a non-rendering <Line>", () => {
    const line = collect(() => (
      <Line dataKey="desktop">
        <Dot variant="border" />
        <ActiveDot variant="colored-border" />
      </Line>
    )).lines[0]!;

    expect(line.dotVariant).toBe("border");
    expect(line.activeDotVariant).toBe("colored-border");
  });

  it("defaults a bare <Dot> to the default variant", () => {
    const line = collect(() => (
      <Line dataKey="desktop">
        <Dot />
      </Line>
    )).lines[0]!;
    expect(line.dotVariant).toBe("default");
    // Still none — no <ActiveDot> was declared.
    expect(line.activeDotVariant).toBe("none");
  });

  it("keeps each line's dots to itself", () => {
    const config = collect(() => (
      <>
        <Line dataKey="desktop">
          <Dot variant="ping" />
        </Line>
        <Line dataKey="mobile" />
      </>
    ));
    expect(config.lines[0]!.dotVariant).toBe("ping");
    expect(config.lines[1]!.dotVariant).toBe("none");
  });
});

describe("collectConfig — presence slots", () => {
  it("treats every slot as absent by default", () => {
    const config = collect(() => <Line dataKey="desktop" />);
    expect(config.xAxis.present).toBe(false);
    expect(config.yAxis.present).toBe(false);
    expect(config.showGrid).toBe(false);
    expect(config.tooltip.present).toBe(false);
    expect(config.legend.present).toBe(false);
    expect(config.brush.present).toBe(false);
  });

  it("turns each on by presence", () => {
    const config = collect(() => (
      <>
        <Grid />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Brush />
      </>
    ));
    expect(config.showGrid).toBe(true);
    expect(config.xAxis).toMatchObject({ present: true, dataKey: "month" });
    expect(config.yAxis.present).toBe(true);
    expect(config.tooltip.present).toBe(true);
    expect(config.legend.present).toBe(true);
    expect(config.brush.present).toBe(true);
  });

  it("keeps the tooltip and legend defaults upstream declares", () => {
    const config = collect(() => (
      <>
        <Tooltip />
        <Legend />
      </>
    ));
    expect(config.tooltip).toEqual({
      present: true,
      variant: "default",
      roundness: "lg",
      cursor: true,
      position: "variable",
    });
    expect(config.legend).toEqual({
      present: true,
      variant: "rounded-square",
      align: "right",
      verticalAlign: "top",
      isClickable: false,
    });
  });

  it("preserves axis formatters and labels", () => {
    const config = collect(() => (
      <>
        <XAxis dataKey="month" label="Month" tickFormatter={(v) => v.slice(0, 3)} hideDots />
        <YAxis label="Users" tickFormatter={(v) => `${v}k`} />
      </>
    ));
    expect(config.xAxis.tickFormatter?.("January", 0)).toBe("Jan");
    expect(config.xAxis.label).toBe("Month");
    expect(config.xAxis.hideDots).toBe(true);
    expect(config.yAxis.tickFormatter?.(12, 0)).toBe("12k");
  });

  it("carries the brush's height, formatter and callback", () => {
    const onChange = () => {};
    const config = collect(() => (
      <Brush height={72} formatLabel={(v) => v.slice(0, 1)} onChange={onChange} />
    ));
    expect(config.brush.height).toBe(72);
    expect(config.brush.formatLabel?.("January", 0)).toBe("J");
    expect(config.brush.onChange).toBe(onChange);
  });
});

describe("collectConfig — control flow", () => {
  it("handles <Show> around a slot, in both directions", () => {
    inRoot(() => {
      const [show, setShow] = createSignal(false);
      const resolved = children(() => (
        <>
          <Line dataKey="desktop" />
          <Show when={show()}>
            <Grid />
          </Show>
        </>
      ));
      const config = createMemo(() => collectConfig(resolved()));

      expect(config().showGrid).toBe(false);
      setShow(true);
      expect(config().showGrid).toBe(true);
      setShow(false);
      expect(config().showGrid).toBe(false);
    });
  });

  it("handles <For> over lines and reacts to the list changing", () => {
    inRoot(() => {
      const [keys, setKeys] = createSignal(["desktop", "mobile"]);
      const resolved = children(() => (
        <For each={keys()}>{(k) => <Line dataKey={k} />}</For>
      ));
      const config = createMemo(() => collectConfig(resolved()));

      expect(config().lines.map((l) => l.dataKey)).toEqual(["desktop", "mobile"]);
      setKeys(["tablet"]);
      expect(config().lines.map((l) => l.dataKey)).toEqual(["tablet"]);
    });
  });

  it("re-collects when a marker prop changes", () => {
    inRoot(() => {
      const [variant, setVariant] = createSignal<"solid" | "dashed">("solid");
      const resolved = children(() => (
        <Line dataKey="desktop" strokeVariant={variant()} />
      ));
      const config = createMemo(() => collectConfig(resolved()));

      expect(config().lines[0]!.strokeVariant).toBe("solid");
      setVariant("dashed");
      expect(config().lines[0]!.strokeVariant).toBe("dashed");
    });
  });

  it("ignores stray non-marker children", () => {
    const config = collect(() => (
      <>
        {null}
        {false}
        {"text"}
        <Line dataKey="desktop" />
      </>
    ));
    expect(config.lines).toHaveLength(1);
  });
});
