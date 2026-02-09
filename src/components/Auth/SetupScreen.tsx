import { useState, useMemo } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useLanguageStore, Language } from "../../stores/languageStore";
import { useTranslation, translateBackendError } from "../../i18n";
import { calculatePasswordStrength } from "../../lib/passwordStrength";

export function SetupScreen() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [createRecoveryKey, setCreateRecoveryKey] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  const { setup, isLoading, error } = useAuthStore();
  const { language, setLanguage } = useLanguageStore();
  const { t } = useTranslation();

  const passwordStrength = useMemo(() => calculatePasswordStrength(password), [password, language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (password.length < 8) {
      setValidationError(t("setup.validationMinLength"));
      return;
    }

    if (password !== confirmPassword) {
      setValidationError(t("setup.validationMismatch"));
      return;
    }

    await setup(password, createRecoveryKey);
  };

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
          <p className="text-gray-500 dark:text-gray-400">{t("setup.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">{t("setup.title")}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              {t("setup.description")}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">
                {t("setup.masterPassword")}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                placeholder={t("setup.passwordPlaceholder")}
                disabled={isLoading}
              />
              {/* Password strength meter */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= passwordStrength.level
                            ? passwordStrength.color
                            : "bg-gray-300 dark:bg-gray-600"
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs ${
                    passwordStrength.level <= 1 ? "text-red-500" :
                    passwordStrength.level === 2 ? "text-yellow-600 dark:text-yellow-500" :
                    "text-green-600 dark:text-green-500"
                  }`}>
                    {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                {t("setup.confirmPassword")}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                placeholder={t("setup.confirmPlaceholder")}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                id="recoveryKey"
                type="checkbox"
                checked={createRecoveryKey}
                onChange={(e) => setCreateRecoveryKey(e.target.checked)}
                className="w-4 h-4 rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                disabled={isLoading}
              />
              <label htmlFor="recoveryKey" className="text-sm">
                {t("setup.generateRecoveryKey")}
              </label>
            </div>
          </div>

          {(validationError || error) && (
            <div className="p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-200 text-sm">
              {validationError || (error ? translateBackendError(error) : null)}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-colors"
          >
            {isLoading ? t("setup.creating") : t("setup.createVault")}
          </button>
        </form>
      </div>
    </div>
  );
}
