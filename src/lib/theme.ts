export const THEME_COOKIE = "hsp_theme";

export type Theme = "light" | "dark";

export function parseTheme(value: string | undefined | null): Theme {
  return value === "dark" ? "dark" : "light";
}
