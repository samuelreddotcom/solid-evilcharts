/**
 * The Preview / Code pair every docs page is built from.
 *
 * The Code tab renders the REGISTRY SOURCE, read through `?shiki` — the exact
 * bytes `shadcn add` writes into the reader's project. That equality is not
 * incidental: a round-trip verified it (52 files, 0 diffs) and boundary.test.ts
 * guards it. Hand-written snippets would drift from the shipped code the first
 * time a chart changed, and nothing would catch it.
 */
import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import type { JSX } from "solid-js";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CopyButton } from "./copy-button";
import { REGISTRY_SOURCES, sourceLabel } from "./registry-sources";

export type ComponentPreviewProps = {
  /** Registry paths relative to src/registry — e.g. "charts/line-chart/parts.tsx". */
  files: string[];
  children: JSX.Element;
};

export function ComponentPreview(props: ComponentPreviewProps) {
  const [selected, setSelected] = createSignal<string>();
  const active = createMemo(() => selected() ?? props.files[0]!);

  return (
    <div class="border-border my-6 overflow-hidden rounded-lg border">
      <Tabs defaultValue="preview">
        <div class="border-border bg-muted/40 border-b px-3 py-2">
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="preview" class="p-6">
          {props.children}
        </TabsContent>

        <TabsContent value="code" class="m-0">
          <Show when={props.files.length > 1}>
            <div class="border-border flex gap-1 overflow-x-auto border-b px-3 py-2">
              <For each={props.files}>
                {(file) => (
                  <button
                    type="button"
                    onClick={() => setSelected(file)}
                    data-active={active() === file ? "" : undefined}
                    class="text-muted-foreground data-active:text-foreground data-active:bg-muted shrink-0 rounded-md px-2 py-1 font-mono text-xs transition-colors"
                  >
                    {sourceLabel(file)}
                  </button>
                )}
              </For>
            </div>
          </Show>
          <SourceView path={active()} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SourceView(props: { path: string }) {
  const load = createMemo(() => REGISTRY_SOURCES[props.path]);
  const [mod] = createResource(load, (fn) => fn());

  return (
    <Show
      when={REGISTRY_SOURCES[props.path]}
      fallback={
        <p class="text-destructive p-4 font-mono text-sm">Unknown registry file: {props.path}</p>
      }
    >
      <Show
        when={mod()}
        fallback={<p class="text-muted-foreground p-4 text-sm">Loading source…</p>}
      >
        {(m) => (
          <div class="relative">
            <div class="absolute top-2 right-2 z-10">
              <CopyButton value={m().code} />
            </div>
            {/* Shiki emits a complete <pre>; rendering it as HTML is the whole
                point of highlighting at build time. The content is our own
                source, read off disk by a Vite plugin — never user input. */}
            <div class="docs-code max-h-[32rem] overflow-auto text-sm" innerHTML={m().html} />
          </div>
        )}
      </Show>
    </Show>
  );
}
