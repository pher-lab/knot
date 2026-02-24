import * as api from "../lib/api";
import { useThemeStore } from "./themeStore";
import { useLanguageStore } from "./languageStore";
import { useAuthStore } from "./authStore";
import { useFontSizeStore } from "./fontSizeStore";

export function saveAllSettings(): void {
  const theme = useThemeStore.getState().theme;
  const language = useLanguageStore.getState().language;
  const autoLockMinutes = useAuthStore.getState().autoLockMinutes;
  const fontSize = useFontSizeStore.getState().fontSize;

  api.saveSettings({
    theme,
    language,
    auto_lock_minutes: autoLockMinutes,
    font_size: fontSize,
  }).catch(() => {
    // Settings save is best-effort; don't disrupt the UI
  });
}
