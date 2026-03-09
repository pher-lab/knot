import { getTranslation } from "../i18n";

export type PasswordStrength = {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
};

// Common weak passwords (lowercase for case-insensitive matching)
const COMMON_PASSWORDS = new Set([
  "password", "12345678", "123456789", "1234567890", "qwerty123",
  "abcdefgh", "abc12345", "password1", "iloveyou", "sunshine",
  "princess", "football", "charlie1", "access14", "trustno1",
  "letmein1", "master12", "dragon12", "monkey12", "shadow12",
  "michael1", "jennifer", "11111111", "00000000", "88888888",
  "12341234", "abcd1234", "qwertyui", "asdfghjk", "zxcvbnm1",
  "baseball", "superman", "computer", "internet", "whatever",
  "passw0rd", "p@ssword", "p@ssw0rd", "admin123", "welcome1",
  "starwars", "pokemon1", "corvette", "kawasaki", "samantha",
  "01234567", "12345678", "23456789", "98765432", "87654321",
]);

function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}

export function calculatePasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) {
    return { level: 0, label: "", color: "bg-gray-300 dark:bg-gray-600" };
  }

  // Dictionary check: common passwords are always weak
  if (isCommonPassword(password)) {
    return { level: 1, label: getTranslation("password.common"), color: "bg-red-500" };
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
