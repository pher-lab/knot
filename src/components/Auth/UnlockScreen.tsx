import { useState, useEffect } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useLanguageStore, Language } from "../../stores/languageStore";
import { useTranslation, translateBackendError } from "../../i18n";

export function UnlockScreen() {
  const [password, setPassword] = useState("");

  const {
    unlock,
    showRecoveryScreen,
    isLoading,
    error,
    clearError,
    lockoutSeconds,
    setLockoutSeconds,
  } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const { t } = useTranslation();

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutSeconds === null || lockoutSeconds <= 0) return;

    const timer = setInterval(() => {
      setLockoutSeconds(lockoutSeconds - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutSeconds, setLockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      await unlock(password);
    }
  };

  const handleRecoveryClick = () => {
    clearError();
    showRecoveryScreen();
  };

  const translatedError = error ? translateBackendError(error) : null;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex items-center justify-center p-4">
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="absolute top-4 right-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded px-2 py-1 focus:outline-none focus:border-blue-500"
      >
        <option value="system">{t("sidebar.languageSystem")}</option>
        <option value="ja">日本語</option>
        <option value="en">English</option>
      </select>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Knot</h1>
          <p className="text-gray-500 dark:text-gray-400">{t("unlock.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">{t("unlock.title")}</h2>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              {t("unlock.masterPassword")}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
              placeholder={t("unlock.passwordPlaceholder")}
              disabled={isLoading}
              autoFocus
            />
          </div>

          {translatedError && (
            <div className="p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-200 text-sm">
              {translatedError}
              {lockoutSeconds !== null && lockoutSeconds > 0 && (
                <div className="mt-2 text-center font-mono text-lg">
                  {t("unlock.retryAfter", { seconds: lockoutSeconds })}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password || (lockoutSeconds !== null && lockoutSeconds > 0)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-colors"
          >
            {isLoading ? t("unlock.unlocking") : t("unlock.unlock")}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleRecoveryClick}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              {t("unlock.forgotPassword")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
