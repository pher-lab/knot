import * as api from "../lib/api";
import { useThemeStore } from "./themeStore";
import { useLanguageStore } from "./languageStore";
import { useAuthStore } from "./authStore";

export function saveAllSettings(): void {
  const theme = useThemeStore.getState().theme;
  const language = useLanguageStore.getState().language;
  const autoLockMinutes = useAuthStore.getState().autoLockMinutes;

  api.saveSettings({
    theme,
    language,
    auto_lock_minutes: autoLockMinutes,
  }).catch(() => {
    // Settings save is best-effort; don't disrupt the UI
  });
}
