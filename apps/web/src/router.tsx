import {
  createBrowserRouter,
  replace,
  type LoaderFunctionArgs,
  type RouteObject,
} from "react-router";
import { RouteErrorPage, RouteFallback } from "@/components/common";
import { RootLayout } from "@/layouts/RootLayout";
import { fetchResource } from "@/lib/api";
import type { RouteHandle } from "@/lib/nav";
import { screenerRedirect } from "@/lib/redirects";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { pageRoutes, type PageRoute } from "@/routes";

function toRouteObject(route: PageRoute): RouteObject {
  const location =
    route.path === "/"
      ? { index: true as const }
      : { path: route.path.slice(1) };
  return {
    ...location,
    handle: route.handle,
    HydrateFallback: RouteFallback,
    lazy: route.page,
    // Starts the page's reads and returns at once: the chunk and the data
    // travel together, and navigation never waits for the data.
    ...(route.data
      ? {
          loader: ({ params, request }: LoaderFunctionArgs) => {
            const search = new URL(request.url).searchParams;
            route.data?.({ params, search }).forEach((r) => fetchResource(r));
            return null;
          },
        }
      : {}),
  };
}

const designHandle: RouteHandle = { title: "Design system" };

/** Addresses from the previous site, kept alive for old links. */
const redirects: RouteObject[] = [
  {
    path: "screener",
    loader: ({ request }) =>
      replace(screenerRedirect(new URL(request.url).searchParams)),
  },
  {
    path: "job/:id/*",
    loader: ({ params }) =>
      replace(`/jobs/${encodeURIComponent(params["id"] ?? "")}`),
  },
  { path: "methodology", loader: () => replace("/about") },
  { path: "data", loader: () => replace("/about") },
  { path: "report", loader: () => replace("/") },
];

/**
 * The route tree: the shell, then every page inside one error boundary, so a
 * page that fails keeps the nav around it.
 */
export const routes: RouteObject[] = [
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        ErrorBoundary: RouteErrorPage,
        children: [
          ...pageRoutes.map(toRouteObject),
          ...redirects,
          ...(import.meta.env.DEV
            ? [
                {
                  path: "design",
                  handle: designHandle,
                  lazy: async () => ({
                    Component: (await import("@/pages/DesignSystemPage"))
                      .DesignSystemPage,
                  }),
                },
              ]
            : []),
          { path: "*", Component: NotFoundPage },
        ],
      },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
