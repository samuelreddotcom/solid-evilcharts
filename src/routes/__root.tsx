import { Outlet, createRootRoute } from "@tanstack/solid-router";

import { SiteNav } from "../components/site-nav";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <SiteNav />
      <Outlet />
    </>
  );
}
