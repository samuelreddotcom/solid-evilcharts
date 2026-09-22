import { Outlet, createRootRoute } from "@tanstack/solid-router";

import { SiteHead } from "../components/site-head";
import { SiteNav } from "../components/site-nav";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <SiteHead />
      <SiteNav />
      <Outlet />
    </>
  );
}
