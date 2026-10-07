export type Theme = "system" | "light" | "dark";

export const THEMES: Theme[] = ["system", "light", "dark"];

/** Stored or received values are untrusted: anything unknown means "no preference". */
export const parseTheme = (v: unknown): Theme | null => (v === "light" || v === "dark" || v === "system" ? v : null);

/** "system" follows the device; the other two are explicit. */
export const resolveTheme = (pref: Theme, systemDark: boolean): "light" | "dark" => (pref === "system" ? (systemDark ? "dark" : "light") : pref);
