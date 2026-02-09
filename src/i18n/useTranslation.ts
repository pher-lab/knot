import { useLanguageStore, ResolvedLanguage } from "../stores/languageStore";
import { translations, TranslationKey } from "./translations";

function resolve(
  language: ResolvedLanguage,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  let text: string = translations[language][key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.split(`{${k}}`).join(String(v));
    }
  }
  return text;
}

export function useTranslation() {
  const resolvedLanguage = useLanguageStore((s) => s.resolvedLanguage);

  function t(key: TranslationKey, params?: Record<string, string | number>): string {
    return resolve(resolvedLanguage, key, params);
  }

  return { t, language: resolvedLanguage };
}

/** Non-hook version for use outside React components */
export function getTranslation(
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const resolvedLanguage = useLanguageStore.getState().resolvedLanguage;
  return resolve(resolvedLanguage, key, params);
}
