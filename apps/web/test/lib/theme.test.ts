import { afterEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, parseThemeChoice, resolveTheme } from "@/lib/theme";
import { stubDeviceTheme } from "../support/mediaQuery";
import indexHtml from "../../index.html?raw";

const STORED = [null, "light", "dark", "system", "", "sepia"] as const;

describe("resolveTheme", () => {
  it("follows the device when nothing was picked", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("keeps an explicit pick whatever the device says", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("treats an unknown stored value as no pick", () => {
    expect(parseThemeChoice("sepia")).toBe("system");
    expect(resolveTheme("sepia", false)).toBe("light");
    expect(resolveTheme("", true)).toBe("dark");
  });
});

/** The inline script `index.html` runs before React mounts. */
function bootScript(): string {
  const match = /<script>([\s\S]*?)<\/script>/.exec(indexHtml);
  if (!match?.[1]) throw new Error("index.html has no inline boot script");
  return match[1];
}

describe("index.html boot script", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
  });

  for (const stored of STORED) {
    for (const deviceIsDark of [true, false]) {
      it(`paints ${resolveTheme(stored, deviceIsDark)} for stored ${JSON.stringify(stored)} on a ${deviceIsDark ? "dark" : "light"} device`, () => {
        stubDeviceTheme(deviceIsDark);
        if (stored !== null) localStorage.setItem(THEME_STORAGE_KEY, stored);
        new Function(bootScript())();
        const expected = resolveTheme(stored, deviceIsDark);
        const root = document.documentElement;
        expect(root).toHaveClass(expected);
        expect(root.classList).toHaveLength(1);
        expect(root.style.colorScheme).toBe(expected);
      });
    }
  }

  it("falls back to the device when storage throws", () => {
    stubDeviceTheme(true);
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      new Function(bootScript())();
    } finally {
      Storage.prototype.getItem = getItem;
    }
    expect(document.documentElement).toHaveClass("dark");
  });
});
