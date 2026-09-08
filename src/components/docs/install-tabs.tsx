/**
 * The install command, per package manager.
 *
 * Only the *runner* differs between them — every one ends up invoking the same
 * shadcn CLI — so the commands are derived from one table rather than written
 * out four times and drifting.
 *
 * The registry namespace is deliberately spelled out here: `shadcn add` with a
 * bare item name resolves against ui.shadcn.com, not against our registry, so
 * the `@solid-foundation/` prefix is load-bearing and not decoration.
 */
import { For } from "solid-js";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CopyButton } from "./copy-button";

/** Must match the `registries` key a consumer puts in components.json. */
export const REGISTRY_NAMESPACE = "@solid-foundation";

const RUNNERS = [
  { id: "pnpm", label: "pnpm", run: "pnpm dlx" },
  { id: "npm", label: "npm", run: "npx" },
  { id: "yarn", label: "yarn", run: "yarn dlx" },
  { id: "bun", label: "bun", run: "bunx" },
] as const;

export function InstallTabs(props: { item: string }) {
  const command = (run: string) => `${run} shadcn@latest add ${REGISTRY_NAMESPACE}/${props.item}`;

  return (
    <div class="border-border my-6 overflow-hidden rounded-lg border">
      <Tabs defaultValue={RUNNERS[0].id}>
        <div class="border-border bg-muted/40 border-b px-3 py-2">
          <TabsList>
            <For each={RUNNERS}>{(r) => <TabsTrigger value={r.id}>{r.label}</TabsTrigger>}</For>
          </TabsList>
        </div>
        <For each={RUNNERS}>
          {(r) => (
            <TabsContent value={r.id} class="relative m-0">
              <div class="absolute top-2 right-2">
                <CopyButton value={command(r.run)} />
              </div>
              <pre class="overflow-x-auto p-4 pr-20 text-sm">
                <code class="font-mono">{command(r.run)}</code>
              </pre>
            </TabsContent>
          )}
        </For>
      </Tabs>
    </div>
  );
}
