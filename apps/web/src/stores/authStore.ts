import { create } from "zustand";

const API = "/api";

interface AuthState {
  authenticated: boolean;
  loading: boolean;
  error: string;
  checkAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  authenticated: false,
  loading: true,
  error: "",

  checkAuth: async () => {
    set({ loading: true });
    try {
      const resp = await fetch(`${API}/auth/me`, { credentials: "include" });
      set({ authenticated: resp.ok, loading: false, error: "" });
    } catch {
      set({ authenticated: false, loading: false, error: "" });
    }
  },

  login: async (username: string, password: string) => {
    set({ error: "" });
    try {
      const resp = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (resp.ok) {
        set({ authenticated: true, error: "" });
        return true;
      }
      const data = await resp.json().catch(() => ({ error: "Login failed" }));
      set({ error: data.error || "Invalid credentials" });
      return false;
    } catch {
      set({ error: "Connection failed" });
      return false;
    }
  },

  logout: async () => {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    set({ authenticated: false });
  },
}));
