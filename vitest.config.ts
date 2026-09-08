import { resolve } from "node:path";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

import { docsIndex } from "./src/plugins/docs-index.ts";
import { mdxPlugin } from "./src/plugins/mdx.ts";

// Kept separate from vite.config.ts on purpose: the router plugin generates
// routeTree.gen.ts and devtools inject a client runtime, neither of which
// belongs in a test run.
export default defineConfig({
  // The docs tests compile the same .mdx the app does, through the same
  // plugin definition — see src/plugins/mdx.ts for why that sharing matters.
  plugins: [
    docsIndex(resolve(import.meta.dirname, "src/content/docs")),
    mdxPlugin(),
    solid({ extensions: [".mdx"] }),
  ],
  // Without these, solid-js resolves to its server build under Vitest and
  // reactivity silently no-ops. Verified in the Phase 0 spike.
  resolve: {
    conditions: ["development", "browser"],
    alias: { "~": resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    // Transforming Ark/Zag on every run dominates the runtime otherwise.
    fsModuleCache: true,
  },
});
