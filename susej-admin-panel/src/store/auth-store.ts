import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminUser } from "@/types";

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  isAuthenticated: boolean;
  // token is legacy-only (older persisted rows may carry one): the session
  // lives in the HttpOnly cookie, never in JS. New sign-ins pass no token.
  setAuth: (user: AdminUser, token?: string | null) => void;
  logout: () => void;
  updateUser: (user: Partial<AdminUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user) => set({ user, token: null, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: "susej-auth",
      partialize: (state) => ({ user: state.user, token: null, isAuthenticated: state.isAuthenticated }),
    }
  )
);
