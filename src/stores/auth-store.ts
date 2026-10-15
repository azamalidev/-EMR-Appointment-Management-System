"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@/lib/types";
import { api, clearTokens, setTokens } from "@/lib/api-client";

interface AuthState {
  user: AuthUser | null;
  loading: boolean; // initial bootstrap
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: AuthUser | null) => void;
  bootstrap: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      setUser: (u) => set({ user: u }),
      login: async (email, password) => {
        const res = await api.post<{ accessToken: string; refreshToken: string; user: AuthUser }>(
          "/auth/login",
          { email, password },
          { auth: false },
        );
        setTokens(res.accessToken, res.refreshToken);
        set({ user: res.user });
      },
      logout: async () => {
        try {
          await api.post("/auth/logout", { refreshToken: localStorage.getItem("emr_refresh_token") });
        } catch {
          /* ignore */
        }
        clearTokens();
        set({ user: null });
      },
      bootstrap: async () => {
        try {
          const me = await api.get<AuthUser>("/auth/me");
          set({ user: me });
        } catch {
          set({ user: null });
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "emr-auth",
      partialize: (s) => ({ user: s.user }),
    },
  ),
);
