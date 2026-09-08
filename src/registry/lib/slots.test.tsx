import { describe, expect, it } from "vitest";
import {
  children,
  createMemo,
  createRoot,
  createSignal,
  For,
  Show,
  type JSX,
} from "solid-js";
import {
  SLOT,
  createMarker,
  filterSlots,
  findSlot,
  isSlot,
  slotProps,
  slotsOf,
} from "./slots";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures.
//
// These stand in for a real chart's markers. Each chart owns its own set, so
// they are defined here rather than shipped from lib/ — nothing in the library
// should export an `Area` that isn't attached to an actual chart.
// ─────────────────────────────────────────────────────────────────────────────

type DotProps = { variant?: string };
type AreaProps = { dataKey: string; variant?: string; children?: JSX.Element };
type XAxisProps = { dataKey: string; tickFormatter?: (v: string) => string };

const Dot = createMarker<"dot", DotProps>("dot");
const ActiveDot = createMarker<"activeDot", DotProps>("activeDot");
const Area = createMarker<"area", AreaProps>("area");
const XAxis = createMarker<"xAxis", XAxisProps>("xAxis");
const Grid = createMarker<"grid", Record<string, never>>("grid");

type ParsedArea = {
  dataKey: string;
  variant: string;
  dotVariant: string;
  activeDotVariant: string;
};

type Parsed = {
  areas: ParsedArea[];
  xAxis: { dataKey: string; tickFormatter?: (v: string) => string } | null;
  showGrid: boolean;
};

function parseSlots(resolved: unknown): Parsed {
  const slots = slotsOf(resolved);
  const out: Parsed = { areas: [], xAxis: null, showGrid: false };

  for (const area of filterSlots(slots, "area")) {
    const props = slotProps<AreaProps>(area);
    // Area renders nothing, so Solid never resolved its children — reaching
    // them is the parser's job.
    const nested = slotsOf(props.children);
    const dot = findSlot(nested, "dot");
    const activeDot = findSlot(nested, "activeDot");
    out.areas.push({
      dataKey: props.dataKey,
      variant: props.variant ?? "gradient",
      dotVariant: dot ? (slotProps<DotProps>(dot).variant ?? "default") : "none",
      activeDotVariant: activeDot
        ? (slotProps<DotProps>(activeDot).variant ?? "default")
        : "none",
    });
  }

  const xAxis = findSlot(slots, "xAxis");
  if (xAxis) {
    const props = slotProps<XAxisProps>(xAxis);
    out.xAxis = { dataKey: props.dataKey, tickFormatter: props.tickFormatter };
  }

  out.showGrid = findSlot(slots, "grid") !== undefined;

  return out;
}

/** Runs body in a tracked root and always disposes. */
function inRoot<T>(body: () => T): T {
  return createRoot((dispose) => {
    try {
      return body();
    } finally {
      dispose();
    }
  });
}

describe("Gate 1 — markers resolve into a slot struct", () => {
  it("parses a flat marker list", () => {
    const parsed = inRoot(() => {
      const resolved = children(() => (
        <>
          <Grid />
          <XAxis dataKey="month" tickFormatter={(v) => v.slice(0, 3)} />
          <Area dataKey="desktop" variant="gradient" />
        </>
      ));
      return parseSlots(resolved());
    });

    expect(parsed.showGrid).toBe(true);
    expect(parsed.xAxis?.dataKey).toBe("month");
    expect(parsed.xAxis?.tickFormatter?.("January")).toBe("Jan");
    expect(parsed.areas).toHaveLength(1);
    expect(parsed.areas[0]).toMatchObject({ dataKey: "desktop", variant: "gradient" });
  });

  it("survives children() without being mangled", () => {
    const raw = inRoot(() => children(() => <Grid />)());
    expect(isSlot(raw)).toBe(true);
    expect((raw as never)[SLOT]).toBe("grid");
  });

  it("works reading props.children directly, without children()", () => {
    const parsed = inRoot(() =>
      parseSlots(
        (
          <>
            <Grid />
            <Area dataKey="mobile" />
          </>
        ) as unknown,
      ),
    );
    expect(parsed.showGrid).toBe(true);
    expect(parsed.areas[0]!.dataKey).toBe("mobile");
  });
});

describe("Gate 2 — nested children resolve", () => {
  it("reads Dot / ActiveDot inside a non-rendering Area", () => {
    const parsed = inRoot(() => {
      const resolved = children(() => (
        <Area dataKey="desktop" variant="gradient">
          <Dot variant="border" />
          <ActiveDot variant="colored-border" />
        </Area>
      ));
      return parseSlots(resolved());
    });

    expect(parsed.areas[0]!.dotVariant).toBe("border");
    expect(parsed.areas[0]!.activeDotVariant).toBe("colored-border");
  });

  it("defaults to none when an Area has no dots", () => {
    const parsed = inRoot(() => parseSlots(children(() => <Area dataKey="x" />)()));
    expect(parsed.areas[0]!.dotVariant).toBe("none");
    expect(parsed.areas[0]!.activeDotVariant).toBe("none");
  });
});

describe("Gate 3 — prop changes re-run the parse", () => {
  it("tracks a signal read through a marker prop getter", () => {
    inRoot(() => {
      const [variant, setVariant] = createSignal("gradient");
      const resolved = children(() => (
        <Area dataKey="desktop" variant={variant()}>
          <Dot variant="border" />
        </Area>
      ));
      const parsed = createMemo(() => parseSlots(resolved()));

      expect(parsed().areas[0]!.variant).toBe("gradient");
      setVariant("solid");
      expect(parsed().areas[0]!.variant).toBe("solid");
      expect(parsed().areas[0]!.dotVariant).toBe("border");
    });
  });

  it("tracks a signal read through a NESTED marker prop getter", () => {
    inRoot(() => {
      const [dot, setDot] = createSignal("border");
      const resolved = children(() => (
        <Area dataKey="desktop">
          <Dot variant={dot()} />
        </Area>
      ));
      const parsed = createMemo(() => parseSlots(resolved()));

      expect(parsed().areas[0]!.dotVariant).toBe("border");
      setDot("ping");
      expect(parsed().areas[0]!.dotVariant).toBe("ping");
    });
  });
});

describe("Gate 4 — <Show> around markers", () => {
  it("adds and removes a slot as the condition flips", () => {
    inRoot(() => {
      const [show, setShow] = createSignal(false);
      const resolved = children(() => (
        <>
          <Area dataKey="desktop" />
          <Show when={show()}>
            <Grid />
          </Show>
        </>
      ));
      const parsed = createMemo(() => parseSlots(resolved()));

      expect(parsed().showGrid).toBe(false);
      expect(parsed().areas).toHaveLength(1);

      setShow(true);
      expect(parsed().showGrid).toBe(true);

      setShow(false);
      expect(parsed().showGrid).toBe(false);
    });
  });
});

describe("Gate 5 — <For> around markers", () => {
  it("maps a list into repeated slots and reacts to list changes", () => {
    inRoot(() => {
      const [keys, setKeys] = createSignal(["desktop", "mobile"]);
      const resolved = children(() => (
        <For each={keys()}>{(k) => <Area dataKey={k} variant="gradient" />}</For>
      ));
      const parsed = createMemo(() => parseSlots(resolved()));

      expect(parsed().areas.map((a) => a.dataKey)).toEqual(["desktop", "mobile"]);

      setKeys(["desktop", "mobile", "tablet"]);
      expect(parsed().areas.map((a) => a.dataKey)).toEqual([
        "desktop",
        "mobile",
        "tablet",
      ]);

      setKeys(["tablet"]);
      expect(parsed().areas.map((a) => a.dataKey)).toEqual(["tablet"]);
    });
  });

  it("handles For with nested Dot children", () => {
    inRoot(() => {
      const resolved = children(() => (
        <For each={["a", "b"]}>
          {(k) => (
            <Area dataKey={k}>
              <Dot variant="border" />
            </Area>
          )}
        </For>
      ));
      const parsed = parseSlots(resolved());
      expect(parsed.areas).toHaveLength(2);
      expect(parsed.areas.every((a) => a.dotVariant === "border")).toBe(true);
    });
  });
});

describe("Gate 6 — junk tolerance", () => {
  it("ignores stray text, null, false and undefined children", () => {
    const parsed = inRoot(() =>
      parseSlots(
        children(() => (
          <>
            {null}
            {false}
            {undefined}
            {"  "}
            <Grid />
          </>
        ))(),
      ),
    );
    expect(parsed.showGrid).toBe(true);
    expect(parsed.areas).toHaveLength(0);
  });
});
