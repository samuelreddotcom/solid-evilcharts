/**
 * jsdom is missing a few browser APIs that Ark UI (via Zag) reaches for during
 * mount. These are inert stubs — enough for a component to mount and emit DOM,
 * deliberately not enough to simulate real layout. Anything that depends on
 * measured geometry belongs in a browser, not here.
 */

if (!("ResizeObserver" in globalThis)) {
  // Ark's scroll-area calls `new win.ResizeObserver(...)` to track content size.
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
}

if (!("IntersectionObserver" in globalThis)) {
  class IntersectionObserverStub {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: readonly number[] = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

// jsdom has no canvas implementation, and its getContext() throws a noisy
// "Not implemented" error rather than returning null. normalizeColor() already
// handles a null context by returning its input untouched, so hand it null
// directly and keep the output readable.
//
// Phase 5 note: ECharts' canvas renderer will need a real context. Either
// install the `canvas` package then, or drive chart tests through the SVG
// renderer, which needs no context at all.
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = (() =>
    null) as typeof HTMLCanvasElement.prototype.getContext;
}

if (!globalThis.matchMedia) {
  // Charts read prefers-reduced-motion; components read breakpoints.
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof globalThis.matchMedia;
}
