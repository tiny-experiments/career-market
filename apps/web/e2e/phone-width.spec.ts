import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * The page itself never scrolls sideways on a phone: at each common phone
 * width, in both themes, the document is no wider than the screen. Only the
 * intended swipe rows (mini tiles, chip rows) scroll, inside themselves.
 */

const WIDTHS = [360, 375, 390, 414] as const;
const THEMES = ["light", "dark"] as const;

/** Every page a visitor can reach, with real data behind each detail page. */
const PAGES = [
  "/",
  "/professions",
  "/professions/devrel",
  "/companies",
  "/companies/u-s-bank",
  "/skills",
  "/skills/spring-boot",
  "/jobs",
  // A long employer name in the apply button once pushed this page to 490 px.
  "/jobs/kr_03s2mz4y7xz2hffe",
  "/search?q=python",
  "/about",
  "/no-such-page",
] as const;

interface Recorded {
  readonly status: number;
  readonly body: unknown;
}

/** API answers recorded from the live site, keyed by path and sorted query. */
const API: Readonly<Record<string, Recorded>> = JSON.parse(
  readFileSync(new URL("./fixtures/api.json", import.meta.url), "utf8"),
) as Record<string, Recorded>;

/** Serves the API from fixtures and keeps every other host offline. */
async function offline(page: Page, missing: string[]): Promise<void> {
  await page.route(
    (url) => url.hostname !== "localhost",
    async (route) => {
      const url = new URL(route.request().url());
      if (!url.pathname.startsWith("/api/")) return route.abort();
      const recorded = API[url.pathname + url.search];
      if (recorded === undefined) {
        missing.push(url.pathname + url.search);
        return route.fulfill({ status: 404, json: { code: "NOT_FOUND" } });
      }
      return route.fulfill({
        status: recorded.status,
        json: recorded.body,
        headers: { "access-control-allow-origin": "*" },
      });
    },
  );
}

/** The elements whose box crosses the screen's edge outside a sideways scroller. */
function overflowing(width: number): string[] {
  const clipped = (el: Element): boolean => {
    for (
      let p = el.parentElement;
      p && p !== document.body;
      p = p.parentElement
    ) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) {
        const box = p.getBoundingClientRect();
        if (box.left >= -0.5 && box.right <= width + 0.5) return true;
      }
    }
    return false;
  };
  return [...document.body.querySelectorAll("*")]
    .filter((el) => {
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) return false;
      return (box.right > width + 0.5 || box.left < -0.5) && !clipped(el);
    })
    .slice(0, 5)
    .map((el) => {
      const box = el.getBoundingClientRect();
      const text = (el.textContent ?? "").trim().slice(0, 40);
      return `<${el.tagName.toLowerCase()} class="${el.getAttribute("class") ?? ""}"> "${text}" spans ${Math.round(box.left)}–${Math.round(box.right)}px`;
    });
}

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test.describe(`${width}px ${theme}`, () => {
      test.use({
        viewport: { width, height: 800 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        colorScheme: theme,
      });

      for (const path of PAGES) {
        test(`${path} fits the screen`, async ({ page }) => {
          const missing: string[] = [];
          await offline(page, missing);
          await page.goto(path);
          await page.locator("main").waitFor();
          await page.waitForLoadState("networkidle");
          // Lazy content (the map, logos) renders on the way down.
          await page.evaluate(() =>
            window.scrollTo(0, document.body.scrollHeight),
          );
          await page.evaluate(() => window.scrollTo(0, 0));

          expect(missing, "API reads with no recorded fixture").toEqual([]);
          // On a phone an over-wide page widens the layout viewport rather
          // than the document alone, so compare with the screen, not innerWidth.
          const measured = await page.evaluate(() => ({
            document: document.documentElement.scrollWidth,
            layout: window.innerWidth,
          }));
          const offenders = await page.evaluate(overflowing, width);
          expect(
            { ...measured, offenders },
            `${path} is wider than a ${width}px screen`,
          ).toEqual({ document: width, layout: width, offenders: [] });
        });
      }
    });
  }
}
