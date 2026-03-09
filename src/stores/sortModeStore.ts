import { create } from "zustand";
import { saveAllSettings } from "./settingsHelper";

export type SortMode = "updated" | "created" | "title";
export type SortDirection = "asc" | "desc";

interface SortModeState {
  sortMode: SortMode;
  sortDirection: SortDirection;
  setSortMode: (mode: SortMode) => void;
  applySortMode: (mode: SortMode) => void;
  setSortDirection: (dir: SortDirection) => void;
  applySortDirection: (dir: SortDirection) => void;
  toggleSortDirection: () => void;
}

export const useSortModeStore = create<SortModeState>((set, get) => ({
  sortMode: "updated",
  sortDirection: "desc",

  setSortMode: (sortMode: SortMode) => {
    set({ sortMode });
    saveAllSettings();
  },

  applySortMode: (sortMode: SortMode) => {
    set({ sortMode });
  },

  setSortDirection: (sortDirection: SortDirection) => {
    set({ sortDirection });
    saveAllSettings();
  },

  applySortDirection: (sortDirection: SortDirection) => {
    set({ sortDirection });
  },

  toggleSortDirection: () => {
    const next = get().sortDirection === "desc" ? "asc" : "desc";
    set({ sortDirection: next });
    saveAllSettings();
  },
}));
