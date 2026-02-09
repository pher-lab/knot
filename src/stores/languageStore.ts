import { create } from "zustand";
import { saveAllSettings } from "./settingsHelper";

export type Language = "ja" | "en" | "system";
export type ResolvedLanguage = "ja" | "en";

interface LanguageState {
  language: Language;
  resolvedLanguage: ResolvedLanguage;
  setLanguage: (language: Language) => void;
  applyLanguage: (language: Language) => void;
}

function getSystemLanguage(): ResolvedLanguage {
  if (typeof navigator !== "undefined") {
    const browserLang = navigator.language || navigator.languages?.[0] || "";
    if (browserLang.startsWith("ja")) {
      return "ja";
    }
  }
  return "en";
}

function resolveLanguage(language: Language): ResolvedLanguage {
  if (language === "system") {
    return getSystemLanguage();
  }
  return language;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: "system",
  resolvedLanguage: resolveLanguage("system"),

  setLanguage: (language: Language) => {
    set({ language, resolvedLanguage: resolveLanguage(language) });
    saveAllSettings();
  },

  applyLanguage: (language: Language) => {
    set({ language, resolvedLanguage: resolveLanguage(language) });
  },
}));
