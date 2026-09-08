declare module "virtual:docs-index" {
  export type DocsIndexEntry = {
    slug: string;
    title: string;
    description?: string;
    path: string;
  };
  export const DOCS_INDEX: DocsIndexEntry[];
}
