# @solid-foundation/charts

Static, beautifully designed charts for **SolidJS**, powered by [Apache ECharts](https://echarts.apache.org/).

> ### Credit where it's due
>
> This project is a SolidJS port of **[EvilCharts](https://evilcharts.com)** by
> [Gurbinder](https://github.com/gurbinder), used under the MIT license. The chart designs,
> variants, component API, and a great deal of the option-building logic originate there.
>
> If you write React, **use the original** — it's excellent, and it's the upstream this
> project follows.

---

## Status

**Pre-alpha — nothing is published yet.** See [`../PLAN.md`](../PLAN.md) for the full build
plan and current phase.

| Phase | | |
|---|---|---|
| 0 | Spike the config-as-children pattern | ✅ done — 11/11 gates |
| 1 | Repo scaffold | ✅ done |
| 2 | Tokens + vendored UI primitives | ✅ done |
| 3 | Engine-neutral core | ✅ done |
| 4 | Shared primitives (dot, tooltip, legend, brush) | ✅ done |
| 5 | Line chart | ✅ done |
| 6 | Area chart | ✅ done |
| 7 | Remaining charts — bar ✅ composed ✅ pie ✅ radial ✅, 2 to go | 👈 in progress |
| 8 | Registry / distribution | |
| 9 | Docs site | |
| 10 | TanStack Charts as a second engine | |

## Stack

- **SolidJS** 1.9
- **Apache ECharts** 6 — modular `echarts/core` entrypoints, canvas + SVG renderers
- **Vite** 8 + **TanStack Solid Router** — mirrors
  [`solid-foundation-design-system`](../../solid-foundation-design-system)
- **Tailwind** 4 + **Ark UI** for the docs chrome
- **oxlint** / **oxfmt**

## Develop

```bash
pnpm install
pnpm dev      # http://localhost:9501
pnpm test     # vitest
pnpm build    # vite build + tsc --noEmit
pnpm lint
```

## License

MIT — see [LICENSE](./LICENSE). Retains the upstream EvilCharts copyright.
