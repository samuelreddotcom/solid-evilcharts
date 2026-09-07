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
