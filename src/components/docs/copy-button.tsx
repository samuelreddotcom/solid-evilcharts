import { Show, createSignal, onCleanup } from "solid-js";

import { cn } from "../../lib/cn";

/**
 * Copy-to-clipboard button.
 *
 * `navigator.clipboard` is undefined on insecure origins and in jsdom, so the
 * failure path is real, not theoretical: the button reports it rather than
 * flashing "Copied" over a clipboard that never changed.
 */
export function CopyButton(props: { value: string; class?: string }) {
  const [state, setState] = createSignal<"idle" | "copied" | "failed">("idle");
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  async function copy() {
    clearTimeout(timer);
    try {
      await navigator.clipboard.writeText(props.value);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label="Copy code"
      class={cn(
        "text-muted-foreground hover:text-foreground hover:bg-muted border-border rounded-md border px-2 py-1 font-mono text-xs transition-colors",
        props.class,
      )}
    >
      <Show when={state() === "idle"}>Copy</Show>
      <Show when={state() === "copied"}>Copied</Show>
      <Show when={state() === "failed"}>Failed</Show>
    </button>
  );
}
