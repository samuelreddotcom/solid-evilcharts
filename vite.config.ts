import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { resolve } from "node:path";
import devtools from "solid-devtools/vite";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

import { docsIndex } from "./src/plugins/docs-index.ts";
import { mdxPlugin } from "./src/plugins/mdx.ts";
import { shikiRaw } from "./src/plugins/shiki.ts";

// `command` is "serve" during `vite` (dev) and "build" during `vite build`.
// Code-splitting routes breaks solid HMR (each route becomes a ?tsr-split
// chunk that isn't a refresh boundary), so we only enable it for builds.
// Mirrors solid-foundation-design-system's config.
export default defineConfig(({ command }) => ({
  plugins: [
    devtools(),
    tailwindcss(),
    docsIndex(resolve(import.meta.dirname, "src/content/docs")),
    tanstackRouter({
      target: "solid",
      autoCodeSplitting: command === "build",
    }),
    shikiRaw(),
    mdxPlugin(),
    solid({ extensions: [".mdx"] }),
  ],
  resolve: {
    alias: { "~": resolve(import.meta.dirname, "src") },
  },
  build: {
    target: "esnext",
  },
  server: {
    // 9500 is the design system; 9501 keeps both runnable side by side.
    port: 9501,
  },
}));
