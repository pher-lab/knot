import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/tauri";
import { useAuthStore } from "./authStore";

vi.mock("@tauri-apps/api/tauri", () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      screen: "loading",
      isLoading: false,
      error: null,
      recoveryKey: null,
      autoLockMinutes: 5,
    });
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  describe("initialize", () => {
    it("should go to unlock screen if vault exists", async () => {
      mockInvoke.mockResolvedValueOnce(true);

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().screen).toBe("unlock");
    });

    it("should go to setup screen if vault does not exist", async () => {
      mockInvoke.mockResolvedValueOnce(false);

      await useAuthStore.getState().initialize();

      expect(useAuthStore.getState().screen).toBe("setup");
    });

    it("should handle errors and go to setup", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Failed"));

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.screen).toBe("setup");
      expect(state.error).toBe("Error: Failed");
    });
  });

  describe("setup", () => {
    it("should setup vault and go to unlocked", async () => {
      mockInvoke.mockResolvedValueOnce({ success: true, recovery_key: null });

      const result = await useAuthStore.getState().setup("password123", false);

      expect(result).toBe(true);
      expect(useAuthStore.getState().screen).toBe("unlocked");
    });

    it("should store recovery key when created", async () => {
      mockInvoke.mockResolvedValueOnce({
        success: true,
        recovery_key: "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
      });

      await useAuthStore.getState().setup("password123", true);

      expect(useAuthStore.getState().recoveryKey).toBe(
        "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
      );
    });

    it("should handle setup failure", async () => {
      mockInvoke.mockResolvedValueOnce({ success: false });

      const result = await useAuthStore.getState().setup("password123", false);

      expect(result).toBe(false);
      expect(useAuthStore.getState().error).toBe("Setup failed");
    });
  });

  describe("unlock", () => {
    it("should unlock and go to unlocked screen", async () => {
      mockInvoke.mockResolvedValueOnce({ success: true });

      const result = await useAuthStore.getState().unlock("password123");

      expect(result).toBe(true);
      expect(useAuthStore.getState().screen).toBe("unlocked");
    });

    it("should handle wrong password", async () => {
      mockInvoke.mockResolvedValueOnce({ success: false, error: "Invalid password" });

      const result = await useAuthStore.getState().unlock("wrongpassword");

      expect(result).toBe(false);
      expect(useAuthStore.getState().error).toBe("Invalid password");
    });
  });

  describe("lock", () => {
    it("should lock and go to unlock screen", async () => {
      useAuthStore.setState({ screen: "unlocked", recoveryKey: "some key" });
      mockInvoke.mockResolvedValueOnce(undefined);

      await useAuthStore.getState().lock();

      const state = useAuthStore.getState();
      expect(state.screen).toBe("unlock");
      expect(state.recoveryKey).toBeNull();
    });

    it("should handle lock errors", async () => {
      useAuthStore.setState({ screen: "unlocked" });
      mockInvoke.mockRejectedValueOnce(new Error("Lock failed"));

      await useAuthStore.getState().lock();

      expect(useAuthStore.getState().error).toBe("Error: Lock failed");
    });
  });

  describe("recover", () => {
    it("should recover with mnemonic and go to unlocked", async () => {
      mockInvoke.mockResolvedValueOnce({ success: true });

      const result = await useAuthStore.getState().recover(
        "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
        "newpassword"
      );

      expect(result).toBe(true);
      expect(useAuthStore.getState().screen).toBe("unlocked");
    });

    it("should handle invalid mnemonic", async () => {
      mockInvoke.mockResolvedValueOnce({ success: false, error: "Invalid mnemonic" });

      const result = await useAuthStore.getState().recover("invalid", "newpassword");

      expect(result).toBe(false);
      expect(useAuthStore.getState().error).toBe("Invalid mnemonic");
    });
  });

  describe("screen navigation", () => {
    it("should show recovery screen", () => {
      useAuthStore.setState({ screen: "unlock", error: "some error" });

      useAuthStore.getState().showRecoveryScreen();

      const state = useAuthStore.getState();
      expect(state.screen).toBe("recovery");
      expect(state.error).toBeNull();
    });

    it("should show unlock screen", () => {
      useAuthStore.setState({ screen: "recovery", error: "some error" });

      useAuthStore.getState().showUnlockScreen();

      const state = useAuthStore.getState();
      expect(state.screen).toBe("unlock");
      expect(state.error).toBeNull();
    });
  });

  describe("autoLockMinutes", () => {
    it("should update autoLockMinutes and save via Rust backend", () => {
      mockInvoke.mockResolvedValueOnce(true); // save_settings response

      useAuthStore.getState().setAutoLockMinutes(10);

      expect(useAuthStore.getState().autoLockMinutes).toBe(10);
      expect(mockInvoke).toHaveBeenCalledWith("save_settings", {
        settings: expect.objectContaining({ auto_lock_minutes: 10 }),
      });
    });

    it("should allow disabling auto-lock with 0", () => {
      mockInvoke.mockResolvedValueOnce(true);

      useAuthStore.getState().setAutoLockMinutes(0);

      expect(useAuthStore.getState().autoLockMinutes).toBe(0);
    });
  });

  describe("clearError", () => {
    it("should clear error", () => {
      useAuthStore.setState({ error: "Some error" });

      useAuthStore.getState().clearError();

      expect(useAuthStore.getState().error).toBeNull();
    });
  });

  describe("clearRecoveryKey", () => {
    it("should clear recovery key", () => {
      useAuthStore.setState({ recoveryKey: "some recovery key" });

      useAuthStore.getState().clearRecoveryKey();

      expect(useAuthStore.getState().recoveryKey).toBeNull();
    });
  });
});
