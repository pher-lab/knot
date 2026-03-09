import * as api from "../lib/api";
import { useThemeStore } from "./themeStore";
import { useLanguageStore } from "./languageStore";
import { useAuthStore } from "./authStore";
import { useFontSizeStore } from "./fontSizeStore";
import { useSortModeStore } from "./sortModeStore";

export function saveAllSettings(): void {
  const theme = useThemeStore.getState().theme;
  const language = useLanguageStore.getState().language;
  const autoLockMinutes = useAuthStore.getState().autoLockMinutes;
  const fontSize = useFontSizeStore.getState().fontSize;
  const sortMode = useSortModeStore.getState().sortMode;
  const sortDirection = useSortModeStore.getState().sortDirection;

  api.saveSettings({
    theme,
    language,
    auto_lock_minutes: autoLockMinutes,
    font_size: fontSize,
    sort_mode: sortMode,
    sort_direction: sortDirection,
  }).catch(() => {
    // Settings save is best-effort; don't disrupt the UI
  });
}
