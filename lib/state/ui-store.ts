"use client";
// Short-lived UI state (plan §6.4): hover + tooltip. Kept out of React render paths where possible.
import { create } from "zustand";

interface UIState {
  hoverArea: string | null;
  hoverPoint: { x: number; y: number } | null;
  hoverPartner: string | null;
  hoverSector: string | null;
  hoverProject: string | null;
  filtersOpen: boolean;
  set: (p: Partial<Omit<UIState, "set">>) => void;
}

export const useUI = create<UIState>((set) => ({
  hoverArea: null,
  hoverPoint: null,
  hoverPartner: null,
  hoverSector: null,
  hoverProject: null,
  filtersOpen: false,
  set: (p) => set(p),
}));
