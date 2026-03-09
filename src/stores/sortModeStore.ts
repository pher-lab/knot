import { create } from "zustand";
import { saveAllSettings } from "./settingsHelper";

export type SortMode = "updated" | "created" | "title";

interface SortModeState {
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;
  applySortMode: (mode: SortMode) => void;
}

export const useSortModeStore = create<SortModeState>((set) => ({
  sortMode: "updated",

  setSortMode: (sortMode: SortMode) => {
    set({ sortMode });
    saveAllSettings();
  },

  applySortMode: (sortMode: SortMode) => {
    set({ sortMode });
  },
}));
