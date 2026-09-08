/**
 * One registry file's source, with the path it installs to as a title bar.
 *
 * Same `?shiki` route as ComponentPreview's Code tab: this is the shipped
 * source, not a transcription. The `target` is the path shadcn writes to in the
 * consumer's project, so a reader can match the panel to a file on disk.
 */
import { Show, createMemo, createResource } from "solid-js";

import { CopyButton } from "./copy-button";
import { REGISTRY_SOURCES } from "./registry-sources";

/** Where `shadcn add` puts a registry file. Mirrors registry.json's targets. */
export function installTarget(registryPath: string): string {
  return `components/solid-charts/${registryPath}`;
}

export function SourceBlock(props: { file: string; target?: string }) {
  const load = createMemo(() => REGISTRY_SOURCES[props.file]);
  const [mod] = createResource(load, (fn) => fn());

  return (
    <Show
      when={REGISTRY_SOURCES[props.file]}
      fallback={
        <p class="text-destructive my-4 font-mono text-sm">Unknown registry file: {props.file}</p>
      }
    >
      <div class="border-border my-4 overflow-hidden rounded-lg border">
        <div class="border-border bg-muted/40 flex items-center justify-between gap-4 border-b px-3 py-2">
          <span class="text-muted-foreground truncate font-mono text-xs">
            {props.target ?? installTarget(props.file)}
          </span>
          <Show when={mod()}>{(m) => <CopyButton value={m().code} />}</Show>
        </div>
        <Show
          when={mod()}
          fallback={<p class="text-muted-foreground p-4 text-sm">Loading source…</p>}
        >
          {/* Shiki emits a complete <pre>; this is our own source read off disk
              by a Vite plugin, never user input. */}
          {(m) => <div class="max-h-[32rem] overflow-auto text-sm" innerHTML={m().html} />}
        </Show>
      </div>
    </Show>
  );
}
