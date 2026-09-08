declare module "virtual:docs-index" {
  export type DocsHeading = { depth: 2 | 3; text: string; id: string };
  export type DocsIndexEntry = {
    slug: string;
    title: string;
    description?: string;
    order: number;
    group?: string;
    path: string;
    headings: DocsHeading[];
  };
  export const DOCS_INDEX: DocsIndexEntry[];
  /** slug → lazy import of that page's compiled MDX module. */
  export const DOCS_LOADERS: Record<string, () => Promise<unknown>>;
}
