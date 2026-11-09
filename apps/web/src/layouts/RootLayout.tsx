import { Outlet, ScrollRestoration } from "react-router";
import { Footer, SiteHeader } from "@/components/layout";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePrefetching } from "@/hooks";

/**
 * The frame every page sits in: the sticky nav unit, the page, the footer.
 * Pages own only what is between them.
 */
export function RootLayout() {
  usePrefetching();

  return (
    <TooltipProvider>
      <div className="flex min-h-svh flex-col">
        <SiteHeader />
        <main className="flex flex-1 flex-col">
          <Outlet />
        </main>
        <Footer />
      </div>
      <Toaster />
      <ScrollRestoration />
    </TooltipProvider>
  );
}
