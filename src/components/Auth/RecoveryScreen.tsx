import { useState, useMemo } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useTranslation, translateBackendError } from "../../i18n";
import { calculatePasswordStrength } from "../../lib/passwordStrength";

export function RecoveryScreen() {
  const [mnemonic, setMnemonic] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const { recover, showUnlockScreen, isLoading, error, clearError } = useAuthStore();
  const { t, language } = useTranslation();

  const passwordStrength = useMemo(() => calculatePasswordStrength(newPassword), [newPassword, language]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const words = mnemonic.trim().split(/\s+/);
    if (words.length !== 12) {
      setValidationError(t("recovery.validationWords"));
      return;
    }

    if (newPassword.length < 8) {
      setValidationError(t("recovery.validationMinLength"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError(t("recovery.validationMismatch"));
      return;
    }

    await recover(mnemonic.trim(), newPassword);
  };

  const handleBackClick = () => {
    clearError();
    showUnlockScreen();
  };

  const translatedError = error ? translateBackendError(error) : null;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">Knot</h1>
          <p className="text-gray-500 dark:text-gray-400">{t("recovery.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">{t("recovery.title")}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              {t("recovery.description")}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="mnemonic" className="block text-sm font-medium mb-2">
                {t("recovery.recoveryKey")}
              </label>
              <textarea
                id="mnemonic"
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors resize-none h-24"
                placeholder={t("recovery.recoveryKeyPlaceholder")}
                disabled={isLoading}
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium mb-2">
                {t("recovery.newPassword")}
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                placeholder={t("recovery.newPasswordPlaceholder")}
                disabled={isLoading}
              />
              {/* Password strength meter */}
              {newPassword.length > 0 && (
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
              <label htmlFor="confirmNewPassword" className="block text-sm font-medium mb-2">
                {t("recovery.confirmPassword")}
              </label>
              <input
                id="confirmNewPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors"
                placeholder={t("recovery.confirmPlaceholder")}
                disabled={isLoading}
              />
            </div>
          </div>

          {(validationError || translatedError) && (
            <div className="p-3 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-200 text-sm">
              {validationError || translatedError}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-colors"
          >
            {isLoading ? t("recovery.recovering") : t("recovery.recover")}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleBackClick}
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              {t("recovery.back")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
