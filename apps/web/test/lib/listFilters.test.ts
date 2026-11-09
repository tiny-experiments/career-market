import { describe, expect, it } from "vitest";
import {
  companiesFiltersFrom,
  jobsFiltersFrom,
  pageFrom,
} from "@/lib/listFilters";
import { screenerRedirect } from "@/lib/redirects";

const params = (value: string) => new URLSearchParams(value);
const defined = (value: object) =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));

describe("pageFrom", () => {
  it.each([
    ["page=3", 3],
    ["", 1],
    ["page=0", 1],
    ["page=-1", 1],
    ["page=abc", 1],
    ["page=1.5", 1],
    ["page=99999999", 1],
  ])("reads %j as page %i", (query, page) => {
    expect(pageFrom(params(query))).toBe(page);
  });
});

describe("companiesFiltersFrom", () => {
  it("keeps what the API accepts and drops the rest", () => {
    expect(
      defined(
        companiesFiltersFrom(
          params("signal=ramping&sort=name&dir=asc&q=%20acme%20&x=1"),
        ),
      ),
    ).toEqual({ signal: "ramping", sort: "name", dir: "asc", q: "acme" });
    expect(
      defined(companiesFiltersFrom(params("signal=wild&sort=zzz&dir=up"))),
    ).toEqual({});
  });
});

describe("jobsFiltersFrom", () => {
  it("reads several values and keeps only the known ones", () => {
    expect(
      defined(
        jobsFiltersFrom(
          params(
            "mode=remote,hybrid,moon&level=senior,staff,nope&family=software,ai-ml",
          ),
        ),
      ),
    ).toEqual({
      workMode: "remote,hybrid",
      level: "senior,staff",
      family: "software,ai-ml",
    });
    expect(defined(jobsFiltersFrom(params("mode=moon")))).toEqual({});
    expect(defined(jobsFiltersFrom(params("family=Bad,Value")))).toEqual({});
  });

  it("knows the longest-open sort", () => {
    expect(defined(jobsFiltersFrom(params("sort=oldest")))).toEqual({
      sort: "oldest",
    });
  });

  it("reads the sub-bar's links", () => {
    expect(defined(jobsFiltersFrom(params("posted=1d")))).toEqual({
      postedWithin: 1,
    });
    expect(defined(jobsFiltersFrom(params("mode=remote")))).toEqual({
      workMode: "remote",
    });
    expect(defined(jobsFiltersFrom(params("pay=listed")))).toEqual({
      hasPay: "true",
    });
  });

  it("drops values the API would refuse", () => {
    expect(
      defined(
        jobsFiltersFrom(
          params(
            "mode=moon&region=mars&country=gb&level=god&posted=9999&salary=-1&currency=XXX&sort=best&family=A%20B",
          ),
        ),
      ),
    ).toEqual({});
  });
});

describe("screenerRedirect", () => {
  it("sends the bare Screener to Jobs", () => {
    expect(screenerRedirect(params(""))).toBe("/jobs");
  });

  it("sends the old views to their own sections", () => {
    expect(screenerRedirect(params("mode=companies&growth=ramping"))).toBe(
      "/companies?signal=ramping",
    );
    expect(screenerRedirect(params("mode=professions"))).toBe("/professions");
    expect(screenerRedirect(params("mode=skills&growth=ramping"))).toBe(
      "/skills",
    );
  });

  it("carries the old filters over under their new names", () => {
    const target = new URL(
      screenerRedirect(
        params(
          "family=swe&workMode=remote&posted=7&salary=USD:150000&jobs=salary&region=europe",
        ),
      ),
      "http://x",
    );
    expect(target.pathname).toBe("/jobs");
    expect(Object.fromEntries(target.searchParams)).toEqual({
      family: "swe",
      mode: "remote",
      posted: "7d",
      currency: "USD",
      salary: "150000",
      sort: "salary",
      region: "europe",
    });
    expect(defined(jobsFiltersFrom(target.searchParams))).toMatchObject({
      family: "swe",
      workMode: "remote",
      postedWithin: 7,
      salaryMin: 150000,
    });
  });
});
