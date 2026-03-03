"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  portalApi,
  type AuthResponse,
  type DeveloperProfile,
  type RegisterRequest,
} from "@/lib/api-client";

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthResponse["user"] | null;
  profile: DeveloperProfile | null;
  isAuthenticated: boolean;

  setAuth: (response: AuthResponse) => void;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  fetchProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      profile: null,
      isAuthenticated: false,

      setAuth: (response: AuthResponse) => {
        set({
          token: response.token,
          refreshToken: response.refresh_token,
          user: response.user,
          isAuthenticated: true,
        });
      },

      login: async (username: string, password: string) => {
        const response = await portalApi.login({ username, password });
        get().setAuth(response);
      },

      register: async (data: RegisterRequest) => {
        const response = await portalApi.register(data);
        get().setAuth(response);
      },

      logout: () => {
        set({
          token: null,
          refreshToken: null,
          user: null,
          profile: null,
          isAuthenticated: false,
        });
      },

      fetchProfile: async () => {
        const profile = await portalApi.getProfile();
        set({ profile });
      },
    }),
    {
      name: "portal-auth",
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
