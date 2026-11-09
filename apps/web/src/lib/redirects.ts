/** Old addresses, sent to where their content lives now. */

/** The Screener's old views each became a section of their own. */
const SCREENER_MODE_HOME: Readonly<Record<string, string>> = {
  companies: "/companies",
  professions: "/professions",
  skills: "/skills",
};

/** The Screener became Jobs; its filters keep working under their new names. */
export function screenerRedirect(search: URLSearchParams): string {
  const home = SCREENER_MODE_HOME[search.get("mode") ?? ""];
  if (home) {
    const growth = search.get("growth");
    return home === "/companies" && growth
      ? `${home}?signal=${encodeURIComponent(growth)}`
      : home;
  }
  const next = new URLSearchParams();
  for (const key of [
    "q",
    "company",
    "family",
    "skill",
    "region",
    "country",
    "level",
  ]) {
    const value = search.get(key);
    if (value) next.set(key, value);
  }
  const workMode = search.get("workMode");
  if (workMode) next.set("mode", workMode);
  const posted = search.get("posted");
  if (posted) next.set("posted", `${posted}d`);
  const sort = search.get("jobs");
  if (sort) next.set("sort", sort);
  const [currency, amount] = (search.get("salary") ?? "").split(":");
  if (currency && amount) {
    next.set("currency", currency);
    next.set("salary", amount);
  }
  const suffix = next.toString();
  return suffix === "" ? "/jobs" : `/jobs?${suffix}`;
}
