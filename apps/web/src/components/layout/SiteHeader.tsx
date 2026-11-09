import { useEffect } from "react";
import { useMatches } from "react-router";
import { TopNav, type TopNavProps } from "@/components/layout/TopNav";
import { SubBar } from "@/components/layout/SubBar";
import type { RouteHandle } from "@/lib/nav";

const SITE = "Career Market";

/**
 * Nav and sub-bar as one sticky unit. The deepest matched route decides the
 * sub-bar and the title through its `handle`; a page never draws either.
 */
export function SiteHeader(props: TopNavProps) {
  const matches = useMatches();
  const handles = matches
    .map((match) => match.handle as RouteHandle | undefined)
    .filter((handle): handle is RouteHandle => handle !== undefined);
  const subBar = [...handles].reverse().find((handle) => handle.subBar)?.subBar;
  const title = [...handles].reverse().find((handle) => handle.title)?.title;

  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;
  }, [title]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto w-full max-w-page">
        <TopNav {...props} />
        {subBar ? (
          <div className="border-t">
            <SubBar tabs={subBar} />
          </div>
        ) : null}
      </div>
    </header>
  );
}
