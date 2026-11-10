/**
 * Theme resolution. A visitor gets their device's light or dark setting unless
 * they picked one in the theme menu; only that pick is stored. The boot script
 * in `index.html` repeats `resolveTheme` before React mounts so the first paint
 * is already the right theme (test/lib/theme.test.ts holds the two together).
 */

/** The localStorage key next-themes and the boot script share. */
export const THEME_STORAGE_KEY = "theme";

export type Theme = "light" | "dark";
export type ThemeChoice = Theme | "system";

/** The menu's choices, in order. */
export const THEME_CHOICES: readonly ThemeChoice[] = [
  "light",
  "dark",
  "system",
];

export const THEME_CHOICE_LABELS: Record<ThemeChoice, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

/** A stored value read back as a choice; anything unknown is "system". */
export function parseThemeChoice(
  stored: string | null | undefined,
): ThemeChoice {
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** The theme to paint: an explicit pick wins, otherwise the device decides. */
export function resolveTheme(
  stored: string | null | undefined,
  deviceIsDark: boolean,
): Theme {
  const choice = parseThemeChoice(stored);
  if (choice !== "system") return choice;
  return deviceIsDark ? "dark" : "light";
}
