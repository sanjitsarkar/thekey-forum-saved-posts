"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getAuthToken, setAuthToken, clearAuthToken, devGetToken } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

// ─── Seed user IDs (match seed.ts) ───────────────────────────────────────────

export const SEED_USERS = [
  { id: "00000000-0000-0000-0000-000000000001", name: "Alice", role: "student" },
  { id: "00000000-0000-0000-0000-000000000002", name: "Bob", role: "student" },
  { id: "00000000-0000-0000-0000-000000000003", name: "Carol", role: "moderator" },
] as const;

type SeedUser = (typeof SEED_USERS)[number];

interface AuthContextValue {
  currentUser: SeedUser | null;
  isAuthenticated: boolean;
  signInAs: (userId: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<SeedUser | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Restore session from localStorage
    const token = getAuthToken();
    const savedUserId = localStorage.getItem("auth_user_id");
    if (token && savedUserId) {
      const user = SEED_USERS.find((u) => u.id === savedUserId) ?? null;
      setCurrentUser(user);
    }
  }, []);

  async function signInAs(userId: string) {
    try {
      const { token } = await devGetToken(userId);
      setAuthToken(token);
      localStorage.setItem("auth_user_id", userId);

      const user = SEED_USERS.find((u) => u.id === userId) ?? null;
      setCurrentUser(user);

      // Invalidate all cached data so it refetches with new user context
      queryClient.clear();
    } catch (err) {
      console.error("Sign-in failed:", err);
    }
  }

  function signOut() {
    clearAuthToken();
    localStorage.removeItem("auth_user_id");
    setCurrentUser(null);
    queryClient.clear();
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: currentUser !== null,
        signInAs,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
