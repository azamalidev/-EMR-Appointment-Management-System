"use client";

import { create } from "zustand";

export type ViewKey =
  | "dashboard"
  | "scheduler"
  | "appointments"
  | "patients"
  | "doctors"
  | "schedules"
  | "audit-logs";

interface NavState {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  // ephemeral scheduler pre-selection (e.g. "book for this doctor/date")
  schedulerDoctorId?: string;
  schedulerDate?: string;
  preselect: (doctorId?: string, date?: string) => void;
}

export const useNavStore = create<NavState>((set) => ({
  view: "dashboard",
  setView: (v) => set({ view: v }),
  preselect: (doctorId, date) => set({ schedulerDoctorId: doctorId, schedulerDate: date }),
}));
