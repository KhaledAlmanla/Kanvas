import { invoke } from "@tauri-apps/api/core";
import type { FontChoice, TextAlign, TextStyle } from "./boardItems";

export type ThemeMode = "dark" | "light";
export type ThemePreference = ThemeMode | "system";
export type OptionBarMode = "hover" | "selection" | "right-click";
export type ToolbarSize = "small" | "medium" | "large";

/** The colours a user can change for one theme mode. All values are hex colours like "#0f172a". */
export type ColorScheme = {
  canvasStart: string;
  canvasEnd: string;
  gridDots: string;
  /** Grid dot opacity, 0–100. */
  gridStrength: number;
  panel: string;
  panelText: string;
  textBox: string;
  text: string;
};

/** App settings: shared by every board, stored in the app's config folder as settings.json. */
export type Settings = {
  general: {
    reopenLastBoard: boolean;
    /** Where Open and Save As start. Null means the system default. */
    defaultBoardFolder: string | null;
    showRecentBoards: boolean;
    recentBoardsLimit: number;
  };
  appearance: {
    theme: ThemePreference;
    colors: Record<ThemeMode, ColorScheme>;
    accent: string;
    /** Distance between grid dots, in board pixels. */
    gridSpacing: number;
  };
  canvas: {
    minZoomPercent: number;
    maxZoomPercent: number;
    optionBar: OptionBarMode;
    rememberToolbarPosition: boolean;
    toolbarSize: ToolbarSize;
  };
  /** Style given to new text boxes. */
  text: TextStyle;
  /** Things the app remembers for you, rather than preferences. */
  memory: {
    lastBoardPath: string | null;
    recentBoards: string[];
    toolbarPosition: { x: number; y: number } | null;
  };
};

export const RECENT_BOARDS_LIMITS = [5, 10, 20];
const MAX_REMEMBERED_BOARDS = Math.max(...RECENT_BOARDS_LIMITS);

export const DEFAULT_COLORS: Record<ThemeMode, ColorScheme> = {
  dark: {
    canvasStart: "#111827",
    canvasEnd: "#0f172a",
    gridDots: "#94a3b8",
    gridStrength: 24,
    panel: "#0f172a",
    panelText: "#e2e8f0",
    textBox: "#111827",
    text: "#f8fafc",
  },
  light: {
    canvasStart: "#eef2ff",
    canvasEnd: "#f8fafc",
    gridDots: "#6366f1",
    gridStrength: 14,
    panel: "#ffffff",
    panelText: "#111827",
    textBox: "#ffffff",
    text: "#0f172a",
  },
};

export const DEFAULT_SETTINGS: Settings = {
  general: {
    reopenLastBoard: false,
    defaultBoardFolder: null,
    showRecentBoards: true,
    recentBoardsLimit: 10,
  },
  appearance: {
    theme: "dark",
    colors: DEFAULT_COLORS,
    accent: "#60a5fa",
    gridSpacing: 18,
  },
  canvas: {
    minZoomPercent: 50,
    maxZoomPercent: 500,
    optionBar: "hover",
    rememberToolbarPosition: true,
    toolbarSize: "medium",
  },
  text: {
    font: "sans",
    size: 16,
    color: null,
    align: "center",
  },
  memory: {
    lastBoardPath: null,
    recentBoards: [],
    toolbarPosition: null,
  },
};

const THEME_PREFERENCES: ThemePreference[] = ["dark", "light", "system"];
const OPTION_BAR_MODES: OptionBarMode[] = ["hover", "selection", "right-click"];
const TOOLBAR_SIZES: ToolbarSize[] = ["small", "medium", "large"];
const FONT_CHOICES: FontChoice[] = ["sans", "serif", "mono", "handwritten"];
const TEXT_ALIGNS: TextAlign[] = ["left", "center", "right"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Fills in anything missing or malformed in a loaded settings file from the defaults,
 * so older or hand-edited files never break the app.
 */
function mergeWithDefaults<T>(defaults: T, loaded: unknown): T {
  if (isRecord(defaults)) {
    if (!isRecord(loaded)) {
      return defaults;
    }

    const merged: Record<string, unknown> = {};
    for (const [key, defaultValue] of Object.entries(defaults)) {
      merged[key] = mergeWithDefaults(defaultValue, loaded[key]);
    }
    return merged as T;
  }

  if (Array.isArray(defaults)) {
    return (Array.isArray(loaded) ? loaded : defaults) as T;
  }

  // A null default (like "no folder chosen") accepts a string.
  if (defaults === null) {
    return (typeof loaded === "string" || loaded === null ? loaded : defaults) as T;
  }

  return (typeof loaded === typeof defaults ? loaded : defaults) as T;
}

const oneOf = <T,>(value: T, allowed: T[], fallback: T) => (allowed.includes(value) ? value : fallback);

const clampNumber = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;

function sanitize(settings: Settings): Settings {
  const { general, appearance, canvas, text, memory } = settings;
  const minZoomPercent = clampNumber(canvas.minZoomPercent, 10, 100);

  return {
    general: {
      ...general,
      recentBoardsLimit: oneOf(general.recentBoardsLimit, RECENT_BOARDS_LIMITS, DEFAULT_SETTINGS.general.recentBoardsLimit),
    },
    appearance: {
      ...appearance,
      theme: oneOf(appearance.theme, THEME_PREFERENCES, DEFAULT_SETTINGS.appearance.theme),
      gridSpacing: clampNumber(appearance.gridSpacing, 8, 64),
    },
    canvas: {
      ...canvas,
      minZoomPercent,
      maxZoomPercent: clampNumber(canvas.maxZoomPercent, Math.max(minZoomPercent, 100), 1000),
      optionBar: oneOf(canvas.optionBar, OPTION_BAR_MODES, DEFAULT_SETTINGS.canvas.optionBar),
      toolbarSize: oneOf(canvas.toolbarSize, TOOLBAR_SIZES, DEFAULT_SETTINGS.canvas.toolbarSize),
    },
    text: {
      ...text,
      font: oneOf(text.font, FONT_CHOICES, DEFAULT_SETTINGS.text.font),
      size: clampNumber(text.size, 8, 96),
      align: oneOf(text.align, TEXT_ALIGNS, DEFAULT_SETTINGS.text.align),
    },
    memory: {
      ...memory,
      recentBoards: memory.recentBoards.filter((path) => typeof path === "string").slice(0, MAX_REMEMBERED_BOARDS),
    },
  };
}

export async function loadSettings(): Promise<Settings> {
  const contents = await invoke<string | null>("load_settings");
  if (!contents) {
    return DEFAULT_SETTINGS;
  }

  return sanitize(mergeWithDefaults(DEFAULT_SETTINGS, JSON.parse(contents)));
}

export async function saveSettings(settings: Settings) {
  await invoke("save_settings", { contents: JSON.stringify(settings, null, 2) });
}

/** Moves a board to the top of the recent list, or removes it when `remove` is true. */
export function updateRecentBoards(settings: Settings, boardPath: string, remove = false): Settings {
  const others = settings.memory.recentBoards.filter((path) => path !== boardPath);
  const recentBoards = remove ? others : [boardPath, ...others].slice(0, MAX_REMEMBERED_BOARDS);
  return { ...settings, memory: { ...settings.memory, recentBoards } };
}

export function hexToRgba(hex: string, alpha: number) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) {
    return hex;
  }

  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/** CSS variables for the canvas, built from the colour scheme of the active theme. */
export function getCanvasVariables(settings: Settings, mode: ThemeMode, showGridDots: boolean): React.CSSProperties {
  const scheme = settings.appearance.colors[mode];
  const { accent } = settings.appearance;

  return {
    "--canvas-bg-1": scheme.canvasStart,
    "--canvas-bg-2": scheme.canvasEnd,
    "--canvas-grid": showGridDots ? hexToRgba(scheme.gridDots, scheme.gridStrength / 100) : "transparent",
    "--panel-bg": hexToRgba(scheme.panel, 0.75),
    "--panel-solid": hexToRgba(scheme.panel, 0.96),
    "--panel-text": scheme.panelText,
    "--handle-accent": hexToRgba(scheme.panelText, 0.7),
    "--item-bg": hexToRgba(scheme.panel, 0.4),
    "--item-text-box": hexToRgba(scheme.textBox, 0.75),
    "--item-text": scheme.text,
    "--accent": accent,
    "--accent-strong": hexToRgba(accent, 0.9),
    "--accent-soft": hexToRgba(accent, 0.24),
    "--accent-faint": hexToRgba(accent, 0.12),
  } as React.CSSProperties;
}
