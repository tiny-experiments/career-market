import { describe, expect, it } from "vitest";
import type { JobFacet } from "@/lib/api";
import { countryName, facetsOf, filterChips, toggled } from "@/lib/jobFilters";

const params = (value: string) => new URLSearchParams(value);
const FACETS: JobFacet[] = [
  { kind: "family", value: "software", count: 10, label: "Software" },
  { kind: "family", value: "ai-ml", count: 5, label: "AI & ML" },
  { kind: "country", value: "", count: 1 },
  { kind: "country", value: "DE", count: 2 },
];

describe("toggled", () => {
  it("adds, removes and empties a comma list", () => {
    expect(toggled(null, "a")).toBe("a");
    expect(toggled("a", "b")).toBe("a,b");
    expect(toggled("a,b", "a")).toBe("b");
    expect(toggled("a", "a")).toBeNull();
  });
});

describe("facetsOf", () => {
  it("keeps one kind and drops blanks", () => {
    expect(facetsOf(FACETS, "country").map((f) => f.value)).toEqual(["DE"]);
    expect(facetsOf(undefined, "family")).toEqual([]);
  });
});

describe("countryName", () => {
  it("names a code and survives a bad one", () => {
    expect(countryName("DE")).toBe("Germany");
    expect(countryName("not a code")).toBe("not a code");
  });
});

describe("filterChips", () => {
  it("makes no chips for a bare list or the sort", () => {
    expect(filterChips(params("sort=salary&page=3"), FACETS)).toEqual([]);
  });

  it("names every filter in words", () => {
    const chips = filterChips(
      params(
        "q=rust&company=Stripe&family=software,ai-ml&region=dach&country=DE&mode=remote&level=staff&posted=7d&salary=150000&pay=listed",
      ),
      FACETS,
    );
    expect(chips.map((chip) => chip.label)).toEqual([
      "“rust”",
      "Stripe",
      "Software",
      "AI & ML",
      "DACH",
      "Germany",
      "Remote",
      "Staff+",
      "Posted this week",
      "From $150,000",
      "Pay listed",
    ]);
  });

  it("takes one value out of a list and leaves the rest", () => {
    const [first] = filterChips(params("family=software,ai-ml"), FACETS);
    expect(first?.patch).toEqual({ family: "ai-ml" });
  });

  it("reads a posted window with or without its unit", () => {
    expect(filterChips(params("posted=7"), FACETS)[0]?.label).toBe(
      "Posted this week",
    );
    expect(filterChips(params("posted=45d"), FACETS)[0]?.label).toBe(
      "Posted in 45 days",
    );
  });
});
