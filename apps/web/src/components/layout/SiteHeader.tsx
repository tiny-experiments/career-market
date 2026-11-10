import { useEffect } from "react";
import { useMatches } from "react-router";
import { TopNav } from "@/components/layout/TopNav";
import { documentTitle } from "@/content";
import type { RouteHandle } from "@/lib/nav";

/**
 * The sticky nav. The deepest matched route decides the title and the meta
 * description through its `handle`; a page never sets either.
 */
export function SiteHeader() {
  const matches = useMatches();
  const handles = matches
    .map((match) => match.handle as RouteHandle | undefined)
    .filter((handle): handle is RouteHandle => handle !== undefined);
  const title = [...handles].reverse().find((handle) => handle.title)?.title;

  const meta = [...handles].reverse().find((handle) => handle.meta)?.meta;

  useEffect(() => {
    document.title = documentTitle(title);
  }, [title]);

  useEffect(() => {
    const tag = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (!tag) return;
    const fallback = tag.dataset["siteDescription"] ?? tag.content;
    tag.dataset["siteDescription"] = fallback;
    tag.content = meta ?? fallback;
  }, [meta]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto w-full max-w-page">
        <TopNav />
      </div>
    </header>
  );
}
