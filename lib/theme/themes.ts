export const THEMES = [
  { id: "obsidian", label: "Obsidian", swatch: ["#1a1d24", "#a78bfa"] },
  { id: "paper",    label: "Paper",    swatch: ["#fafaf7", "#7c3aed"] },
  { id: "oceanic",  label: "Oceanic",  swatch: ["#16242e", "#5fd0d6"] },
  { id: "sunset",   label: "Sunset",   swatch: ["#241712", "#f59e6b"] },
  { id: "forest",   label: "Forest",   swatch: ["#15201a", "#5fc28a"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "obsidian";
export const THEME_STORAGE_KEY = "cairn:theme";
/** Previous brand key — read once for migration. */
export const LEGACY_THEME_STORAGE_KEY = "osama:theme";
