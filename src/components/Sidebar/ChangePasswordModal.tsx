import { useState, useMemo } from "react";
import { useTranslation, translateBackendError } from "../../i18n";
import { calculatePasswordStrength } from "../../lib/passwordStrength";
import * as api from "../../lib/api";

interface ChangePasswordModalProps {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { t, language } = useTranslation();

  const passwordStrength = useMemo(
    () => calculatePasswordStrength(newPassword),
    [newPassword, language]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setBackendError(null);

    if (newPassword.length < 8) {
      setValidationError(t("changePassword.validationMinLength"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError(t("changePassword.validationMismatch"));
      return;
    }

    setIsLoading(true);
    try {
      const result = await api.changePassword(currentPassword, newPassword);
      if (result.success) {
        setSuccess(true);
      } else {
        setBackendError(result.error || "Password change failed");
      }
    } catch (e) {
      setBackendError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const translatedError = backendError
    ? translateBackendError(backendError)
    : null;

  if (success) {
    return (
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4 p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-gray-900 dark:text-white font-medium mb-4">
              {t("changePassword.success")}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t("changePassword.title")}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="cp-current"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("changePassword.currentPassword")}
              </label>
              <input
                id="cp-current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
                placeholder={t("changePassword.currentPlaceholder")}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div>
              <label
                htmlFor="cp-new"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("changePassword.newPassword")}
              </label>
              <input
                id="cp-new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
                placeholder={t("changePassword.newPlaceholder")}
                disabled={isLoading}
              />
              {newPassword.length > 0 && (
                <div className="mt-1.5">
                  <div className="flex gap-1 mb-0.5">
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
                  <p
                    className={`text-xs ${
                      passwordStrength.level <= 1
                        ? "text-red-500"
                        : passwordStrength.level === 2
                          ? "text-yellow-600 dark:text-yellow-500"
                          : "text-green-600 dark:text-green-500"
                    }`}
                  >
                    {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="cp-confirm"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t("changePassword.confirmPassword")}
              </label>
              <input
                id="cp-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors"
                placeholder={t("changePassword.confirmPlaceholder")}
                disabled={isLoading}
              />
            </div>

            {(validationError || translatedError) && (
              <div className="p-2.5 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-200 text-sm">
                {validationError || translatedError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                {t("changePassword.cancel")}
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {isLoading
                  ? t("changePassword.changing")
                  : t("changePassword.change")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
