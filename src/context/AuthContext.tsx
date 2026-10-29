"use client";

/**
 * src/context/AuthContext.tsx
 *
 * WHY THIS EXISTS:
 * next-auth provided useSession() to every component — it managed session state,
 * token refresh, and user data transparently.
 *
 * Now that auth lives in FastAPI (JWTs via /auth/login + /auth/me), we need our
 * own equivalent: a React context that:
 *  - On mount, validates the stored JWT via GET /auth/me
 *  - Provides the current user + loading state to all components
 *  - Exposes a signOut() that clears tokens and redirects to the sign-in page
 *  - Exposes refreshUser() so any component can re-validate after profile changes
 *
 * Migration note — components that previously did:
 *   const { data: session } = useSession()
 *   const user = session?.user
 * Now do:
 *   const { user } = useAuth()
 *
 * FastAPI returns snake_case (`onboarding_complete`); we map to camelCase here so
 * the rest of the frontend can stay consistent.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { getAccessToken, clearTokens } from "@/lib/tokenStore";
import { apiClient } from "@/lib/apiClient";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  /** Mapped from FastAPI's snake_case `onboarding_complete` field */
  onboardingComplete: boolean;
  // Preferences — set during onboarding, editable via profile page
  skillLevel:        string | null;
  weeklyHours:       number | null;
  pace:              string | null;
  deadline:          string | null;   // ISO datetime string or null
  preferredFormats:  string[] | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Clear tokens, reset state, and redirect to /auth/signin */
  signOut: () => void;
  /** Re-validate the stored token against FastAPI — use after profile updates */
  refreshUser: () => Promise<void>;
}

// ─── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  signOut: () => {},
  refreshUser: async () => {},
});

// ─── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Hit GET /auth/me with the stored access token.
   * If it succeeds → populate user state.
   * If it fails (401 / network error) → clear tokens and treat as logged-out.
   *
   * WHY useCallback: this function is referenced in useEffect's dep array.
   * Without useCallback the reference changes on every render, causing
   * the effect to loop.
   */
  const fetchUser = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      // Do NOT pass the token explicitly — let apiClient auto-inject it.
      // Passing { token } explicitly disables the 401→refresh interceptor,
      // meaning an expired access token would immediately clear tokens and
      // log the user out instead of silently refreshing.
      const res = await apiClient.get<{ user: Record<string, unknown> }>(
        "/auth/me"
      );
      const raw = res.user;
      setUser({
        id: raw.id as string,
        name: (raw.name as string | null) ?? null,
        email: raw.email as string,
        image: (raw.image as string | null) ?? null,
        // FastAPI returns snake_case — map here, keep camelCase everywhere else
        onboardingComplete: (raw.onboarding_complete as boolean) ?? false,
        skillLevel:       (raw.skill_level as string | null) ?? null,
        weeklyHours:      (raw.weekly_hours as number | null) ?? null,
        pace:             (raw.pace as string | null) ?? null,
        deadline:         (raw.deadline as string | null) ?? null,
        preferredFormats: Array.isArray(raw.preferred_formats)
          ? (raw.preferred_formats as string[])
          : null,
      });
    } catch {
      // Token is invalid or expired; apiClient will attempt a refresh internally.
      // If we still land here, the token is unrecoverable — clear and log out.
      clearTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Validate token on every mount (page load / tab focus restore)
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const signOut = useCallback(() => {
    clearTokens();
    setUser(null);
    // Hard-navigate so all in-memory state (SWR caches etc.) is flushed
    window.location.href = "/auth/signin";
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signOut,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useAuth — drop-in replacement for useSession() from next-auth.
 *
 * Previously:
 *   const { data: session } = useSession()
 *   const user = session?.user
 *
 * Now:
 *   const { user } = useAuth()
 */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
