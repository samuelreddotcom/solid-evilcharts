/** Fixed-height wrapper, so every docs demo reserves the same space. */
import type { JSX } from "solid-js";

export function DemoFrame(props: { children: JSX.Element; class?: string }) {
  return <div class={props.class ?? "h-72 w-full"}>{props.children}</div>;
}
