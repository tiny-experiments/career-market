import { useMemo, useState } from "react";
import { Logo } from "@/components/data/Logo";
import {
  SearchBox,
  type SearchGroup,
  type SearchResult,
} from "@/components/layout/SearchBox";
import { useSiteSearch } from "@/hooks/useSiteSearch";
import { SEARCH_MIN_LENGTH, type SiteSearchResults } from "@/lib/api";

function toGroups(
  results: SiteSearchResults | null,
  query: string,
): SearchGroup[] {
  if (query.length < SEARCH_MIN_LENGTH) return [];
  const groups: SearchGroup[] = (results?.groups ?? []).map((group) => ({
    heading: group.title,
    items: group.hits.map((hit): SearchResult => ({
      id: `${hit.kind}:${hit.id}`,
      label: hit.label,
      to: hit.href,
      logo: (
        <Logo
          name={hit.label}
          domain={hit.domain}
          size="sm"
          shape={hit.kind === "company" ? "round" : "square"}
        />
      ),
      ...(hit.sublabel === null ? {} : { hint: hit.sublabel }),
    })),
  }));
  groups.push({
    heading: "Jobs",
    items: (results?.roles ?? []).map((role) => ({
      id: `job:${role.id}`,
      label: role.title,
      hint: role.company,
      to: role.url,
    })),
  });
  if (groups.some((group) => group.items.length > 0)) {
    groups.push({
      heading: "More",
      items: [
        {
          id: "all-results",
          label: `See all results for “${query}”`,
          to: `/search?q=${encodeURIComponent(query)}`,
        },
      ],
    });
  }
  return groups;
}

/** The search in the nav: `SearchBox` with the site's own answers behind it. */
export function GlobalSearch({ className }: { readonly className?: string }) {
  const [query, setQuery] = useState("");
  const { results, loading } = useSiteSearch(query);
  const trimmed = query.trim();
  const groups = useMemo(() => toGroups(results, trimmed), [results, trimmed]);

  return (
    <SearchBox
      groups={groups}
      query={query}
      onQueryChange={setQuery}
      loading={loading}
      filter={false}
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
      {...(className === undefined ? {} : { className })}
    />
  );
}
