import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "../stores/authStore";

/**
 * Hook that automatically locks the vault after a period of inactivity.
 * Monitors mouse movement, keyboard input, and clicks.
 */
export function useAutoLock() {
  const { screen, autoLockMinutes, lock } = useAuthStore();
  const timeoutRef = useRef<number | null>(null);

  const resetTimer = useCallback(() => {
    // Clear existing timer
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Don't set timer if disabled or not unlocked
    if (autoLockMinutes <= 0 || screen !== "unlocked") {
      return;
    }

    // Set new timer
    timeoutRef.current = window.setTimeout(() => {
      lock();
    }, autoLockMinutes * 60 * 1000);
  }, [autoLockMinutes, screen, lock]);

  useEffect(() => {
    // Only active when unlocked
    if (screen !== "unlocked" || autoLockMinutes <= 0) {
      return;
    }

    // Activity events to monitor
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

    // Throttle to avoid excessive timer resets
    let lastActivity = Date.now();
    const throttleMs = 1000; // 1 second throttle

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivity > throttleMs) {
        lastActivity = now;
        resetTimer();
      }
    };

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [screen, autoLockMinutes, resetTimer]);
}
