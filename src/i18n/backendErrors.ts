import { getTranslation } from "./useTranslation";

/**
 * Translate backend error messages (English) to the current language.
 * Unknown errors are returned as-is.
 */
export function translateBackendError(message: string): string {
  // "Invalid password. 3 attempts remaining."
  const attemptsMatch = /^Invalid password\.\s*(\d+)\s*attempts? remaining\.?$/.exec(message);
  if (attemptsMatch) {
    return getTranslation("backendError.invalidPasswordWithAttempts", { n: attemptsMatch[1] });
  }

  // "Invalid password"
  if (message === "Invalid password") {
    return getTranslation("backendError.invalidPassword");
  }

  // "Too many failed attempts" (lockout with no remaining)
  if (/too many failed attempts/i.test(message)) {
    return getTranslation("backendError.tooManyAttempts");
  }

  if (message === "Recovery key not set up") {
    return getTranslation("backendError.recoveryNotSetUp");
  }

  // "Invalid recovery key. 3 attempts remaining."
  const recoveryAttemptsMatch = /^Invalid recovery key\.\s*(\d+)\s*attempts? remaining\.?$/.exec(message);
  if (recoveryAttemptsMatch) {
    return getTranslation("backendError.invalidRecoveryKeyWithAttempts", { n: recoveryAttemptsMatch[1] });
  }

  if (message === "Invalid recovery key") {
    return getTranslation("backendError.invalidRecoveryKey");
  }

  if (message === "Invalid recovery data") {
    return getTranslation("backendError.invalidRecoveryData");
  }

  if (message === "Vault already exists") {
    return getTranslation("backendError.vaultAlreadyExists");
  }

  if (message === "Setup failed") {
    return getTranslation("backendError.setupFailed");
  }

  if (message === "Unlock failed") {
    return getTranslation("backendError.unlockFailed");
  }

  if (message === "Recovery failed") {
    return getTranslation("backendError.recoveryFailed");
  }

  // Unknown error - return as-is
  return message;
}
