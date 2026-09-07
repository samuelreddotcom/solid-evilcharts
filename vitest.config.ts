import { resolve } from "node:path";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts on purpose: the router plugin generates
// routeTree.gen.ts and devtools inject a client runtime, neither of which
// belongs in a test run.
export default defineConfig({
  plugins: [solid()],
  // Without these, solid-js resolves to its server build under Vitest and
  // reactivity silently no-ops. Verified in the Phase 0 spike.
  resolve: {
    conditions: ["development", "browser"],
    alias: { "~": resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
