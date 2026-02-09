import { create } from "zustand";
import { appWindow } from "@tauri-apps/api/window";
import { saveAllSettings } from "./settingsHelper";

export type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  applyTheme: (theme: Theme) => void;
  initSystemTheme: () => Promise<void>;
}

let systemTheme: "light" | "dark" = "light";

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "system",
  resolvedTheme: "light",

  setTheme: (theme: Theme) => {
    set({ theme, resolvedTheme: theme === "system" ? systemTheme : theme });
    saveAllSettings();
  },

  applyTheme: (theme: Theme) => {
    set({ theme, resolvedTheme: theme === "system" ? systemTheme : theme });
  },

  initSystemTheme: async () => {
    try {
      const osTheme = await appWindow.theme();
      systemTheme = osTheme === "dark" ? "dark" : "light";
    } catch {
      // Fallback: keep "light"
    }
    const { theme } = get();
    set({ resolvedTheme: theme === "system" ? systemTheme : theme });
  },
}));

// Listen for OS theme changes via Tauri native API
appWindow.onThemeChanged(({ payload: osTheme }) => {
  systemTheme = osTheme === "dark" ? "dark" : "light";
  const state = useThemeStore.getState();
  if (state.theme === "system") {
    useThemeStore.setState({ resolvedTheme: systemTheme });
  }
}).catch(() => {});
