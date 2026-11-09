import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { LocationProbe } from "./LocationProbe";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Renders `ui` inside a memory router at `path`, with the providers the shell
 * gives every page. `extraRoutes` are the destinations a click might reach.
 */
export function renderWithRouter(
  ui: ReactNode,
  {
    path = "/",
    routePath,
    extraRoutes = [],
  }: {
    path?: string;
    /** The route's own pattern when the page reads params, e.g. `/professions/:code`. */
    routePath?: string;
    extraRoutes?: { path: string; element: ReactNode }[];
  } = {},
) {
  const pathname = path.split("?")[0] ?? "/";
  const router = createMemoryRouter(
    [
      {
        path: routePath ?? pathname,
        element: (
          <>
            {ui}
            <LocationProbe />
          </>
        ),
      },
      ...extraRoutes.map((route) => ({
        path: route.path,
        element: (
          <>
            {route.element}
            <LocationProbe />
          </>
        ),
      })),
      { path: "*", element: <LocationProbe /> },
    ],
    { initialEntries: [path] },
  );
  return render(
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>,
  );
}
