import { create } from "zustand";
import { saveAllSettings } from "./settingsHelper";

export type FontSize = "small" | "medium" | "large";

interface FontSizeState {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  applyFontSize: (size: FontSize) => void;
}

export const useFontSizeStore = create<FontSizeState>((set) => ({
  fontSize: "medium",

  setFontSize: (fontSize: FontSize) => {
    set({ fontSize });
    saveAllSettings();
  },

  applyFontSize: (fontSize: FontSize) => {
    set({ fontSize });
  },
}));
