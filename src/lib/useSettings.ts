import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings, type ThemeMode } from "./settings";

const SAVE_DELAY_MS = 400;

/** Loads settings.json once, then saves it shortly after every change. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    loadSettings()
      .catch((error) => {
        console.error("Could not load settings, using defaults.", error);
        return DEFAULT_SETTINGS;
      })
      .then((loaded) => {
        if (!isCancelled) {
          setSettings(loaded);
          setIsLoaded(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    // Don't overwrite the file with defaults before it has been read.
    if (!isLoaded) {
      return;
    }

    // Waits for a pause, so dragging the toolbar or a slider writes the file once, not on every frame.
    const timeout = window.setTimeout(() => {
      saveSettings(settings).catch((error) => console.error("Could not save settings.", error));
    }, SAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [settings, isLoaded]);

  return { settings, setSettings, isLoaded };
}

/** The operating system's light or dark mode, kept up to date while the app runs. */
export function useSystemTheme(): ThemeMode {
  const query = "(prefers-color-scheme: dark)";
  const [theme, setTheme] = useState<ThemeMode>(() => (window.matchMedia(query).matches ? "dark" : "light"));

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const media = window.matchMedia(query);
    const handleMediaChange = () => setTheme(media.matches ? "dark" : "light");

    // Tauri knows the system theme more reliably than the webview on some platforms; the media query is the fallback.
    appWindow
      .theme()
      .then((windowTheme) => {
        if (windowTheme) {
          setTheme(windowTheme);
        }
      })
      .catch(() => {});

    const unlistenPromise = appWindow.onThemeChanged(({ payload }) => setTheme(payload));
    media.addEventListener("change", handleMediaChange);

    return () => {
      media.removeEventListener("change", handleMediaChange);
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return theme;
}
