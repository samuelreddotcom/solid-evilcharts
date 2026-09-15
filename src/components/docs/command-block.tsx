/**
 * A shell command, per package manager.
 *
 * Two shapes, one table:
 *   <CommandBlock packages={["echarts"]} />   → add a dependency
 *   <CommandBlock registryItem="line-chart" /> → run the shadcn CLI
 *
 * They differ only in the verb (`add` vs the dlx-style runner), so deriving
 * both from one table keeps a fifth package manager a one-line change instead
 * of an eight-place edit.
 */
import { For, Show } from "solid-js";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CopyButton } from "./copy-button";

/**
 * The GitHub item address prefix, `owner/repo`.
 *
 * A GitHub repository with a root registry.json IS the registry — there is no
 * host, no base URL and nothing for a consumer to add to components.json. Keep
 * this in step with OWNER/REPO in scripts/build-registry.mts —
 * registry-refs.test.ts asserts the two agree.
 */
export const REGISTRY_REPO = "thesambayo/solid-evilcharts";

const MANAGERS = [
  { id: "pnpm", label: "pnpm", add: "pnpm add", exec: "pnpm dlx" },
  { id: "npm", label: "npm", add: "npm install", exec: "npx" },
  { id: "yarn", label: "yarn", add: "yarn add", exec: "yarn dlx" },
  { id: "bun", label: "bun", add: "bun add", exec: "bunx" },
] as const;

type Props = { packages?: string[]; registryItem?: string };

function commandFor(pm: (typeof MANAGERS)[number], props: Props): string {
  if (props.registryItem) {
    return `${pm.exec} shadcn@latest add ${REGISTRY_REPO}/${props.registryItem}`;
  }
  return `${pm.add} ${(props.packages ?? []).join(" ")}`;
}

export function CommandBlock(props: Props) {
  return (
    <div class="border-border my-4 overflow-hidden rounded-lg border">
      <Tabs defaultValue={MANAGERS[0].id}>
        <div class="border-border bg-muted/40 border-b px-3 py-2">
          <TabsList>
            <For each={MANAGERS}>{(pm) => <TabsTrigger value={pm.id}>{pm.label}</TabsTrigger>}</For>
          </TabsList>
        </div>
        <For each={MANAGERS}>
          {(pm) => (
            <TabsContent value={pm.id} class="relative m-0">
              <div class="absolute top-2 right-2">
                <CopyButton value={commandFor(pm, props)} />
              </div>
              <pre class="overflow-x-auto p-4 pr-20 text-sm">
                <code class="font-mono">{commandFor(pm, props)}</code>
              </pre>
            </TabsContent>
          )}
        </For>
      </Tabs>
      <Show when={!props.registryItem && !props.packages?.length}>
        <p class="text-destructive p-4 text-sm">
          CommandBlock needs either `packages` or `registryItem`.
        </p>
      </Show>
    </div>
  );
}
