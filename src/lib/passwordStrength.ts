import { getTranslation } from "../i18n";

export type PasswordStrength = {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
};

export function calculatePasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) {
    return { level: 0, label: "", color: "bg-gray-300 dark:bg-gray-600" };
  }

  let score = 0;

  // Length checks
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  // Character variety checks
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Map score to strength level
  if (score <= 2) {
    return { level: 1, label: getTranslation("password.weak"), color: "bg-red-500" };
  } else if (score <= 4) {
    return { level: 2, label: getTranslation("password.fair"), color: "bg-yellow-500" };
  } else if (score <= 5) {
    return { level: 3, label: getTranslation("password.strong"), color: "bg-green-500" };
  } else {
    return { level: 4, label: getTranslation("password.veryStrong"), color: "bg-emerald-500" };
  }
}
