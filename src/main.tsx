import { RouterProvider, createRouter } from "@tanstack/solid-router";
import "solid-devtools";
import { render } from "solid-js/web";

import { routeTree } from "./routeTree.gen";

import "./styles/styles.css";

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  defaultStaleTime: 5000,
  scrollRestoration: true,
});

declare module "@tanstack/solid-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app")!;

if (!rootElement.innerHTML) {
  render(() => <RouterProvider router={router} />, rootElement);
}
