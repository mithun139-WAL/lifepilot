/**
 * src/lib/tokenStore.ts
 *
 * WHY THIS EXISTS:
 * next-auth managed tokens transparently via HttpOnly cookies.
 * Now that we call FastAPI directly and receive JWTs ourselves,
 * we need a single place to store, retrieve, and clear those tokens.
 *
 * Two persistence layers:
 * - localStorage: the real store for access_token + refresh_token
 *   (survives page refresh; client-only)
 * - Plain cookie "lp_access_token": middleware reads this to decide
 *   whether the user is logged in and which route to allow.
 *
 * IMPORTANT SECURITY NOTE:
 * The middleware only checks cookie *presence* — it cannot verify the JWT
 * signature because Next.js Edge Runtime has no jose/jsonwebtoken available.
 * Real authentication enforcement happens at the FastAPI layer on every
 * API call. The cookie is purely a routing hint.
 */

const ACCESS_KEY = "lp_access_token";
const REFRESH_KEY = "lp_refresh_token";

// ─── Cookie helpers ────────────────────────────────────────────────────────

function setCookie(name: string, value: string, days = 7): void {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// ─── Public API ────────────────────────────────────────────────────────────

/** Persist both tokens after a successful login or token refresh. */
export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  // Plant a readable cookie so middleware can gate protected routes.
  setCookie(ACCESS_KEY, accessToken);
}

/** Returns the stored JWT access token, or null if not authenticated. */
export function getAccessToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

/** Returns the stored refresh token, or null if unavailable. */
export function getRefreshToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

/**
 * Clear both tokens from localStorage and delete the cookie.
 * Called on explicit sign-out or when a token refresh fails.
 */
export function clearTokens(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
  deleteCookie(ACCESS_KEY);
}
