/**
 * src/lib/apiClient.ts
 *
 * Centralized API client for all backend calls.
 *
 * WHY THIS EXISTS:
 * Every fetch/useSWR call was hardcoded with relative paths like "/api/goals".
 * That couples the frontend permanently to the Next.js API routes.
 *
 * With this client:
 * - One place controls where API calls go
 * - During migration: NEXT_PUBLIC_API_URL is empty → falls back to /api (Next.js routes)
 * - Per feature: set the base path to the FastAPI URL once that feature is migrated
 * - After full migration: NEXT_PUBLIC_API_URL points to FastAPI, Next.js routes are deleted
 *
 * NEW in this version:
 * - Auto-injects Bearer token from tokenStore when NEXT_PUBLIC_API_URL is set (FastAPI mode)
 * - On 401: attempts a silent token refresh via POST /auth/refresh
 *   If refresh succeeds → retries the original request with the new token
 *   If refresh fails → clears tokens + redirects to /auth/signin
 * - Callers can still pass `token` explicitly to override the auto-injected token
 *
 * USAGE — drop-in replacement for raw fetch:
 *   Before: const res = await fetch("/api/goals")
 *   After:  const res = await apiClient.get("/goals")
 *
 * USAGE — drop-in for useSWR:
 *   Before: useSWR("/api/dashboard/stats", fetcher)
 *   After:  useSWR(apiClient.url("/dashboard/stats"), fetcher)
 */

import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "./tokenStore";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

// ─── URL builder ─────────────────────────────────────────────────────────────

/**
 * Build the full URL for a given path.
 *
 * During migration:
 *   NEXT_PUBLIC_API_URL not set → API_BASE = "" → url("/goals") = "/api/goals"
 *   (Next.js API routes still handle it — no breakage)
 *
 * After migration:
 *   NEXT_PUBLIC_API_URL = "http://localhost:8000/api/v1"
 *   url("/goals") = "http://localhost:8000/api/v1/goals"
 */
function url(path: string): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (API_BASE) {
    return `${API_BASE}${cleanPath}`;
  }
  return `/api${cleanPath}`;
}

// ─── Token refresh ─────────────────────────────────────────────────────────

/**
 * Shared refresh promise — solves the concurrent-refresh race condition.
 *
 * THE PROBLEM:
 * Five dashboard components mount simultaneously. All fire their GET requests
 * with the same access token. If that token is expired, all five get 401.
 * All five call tryRefreshTokens() concurrently. Without coordination:
 *   - Call 1: starts refresh, sets isRefreshing = true
 *   - Calls 2-5: see isRefreshing = true, immediately return null
 *   - Calls 2-5: null treated as "refresh failed" → clearTokens() → redirect
 *   → User is logged out even though Call 1 would have succeeded!
 *
 * THE FIX:
 * Use a shared Promise. While a refresh is in flight, all concurrent callers
 * await the SAME promise. When the refresh resolves, everyone gets the result.
 *   - Call 1: starts refresh, stores promise in refreshPromise
 *   - Calls 2-5: see refreshPromise !== null, await the SAME promise
 *   - All five get the new token and retry their original requests
 */
let refreshPromise: Promise<string | null> | null = null;

/**
 * Attempt to get a new access token using the stored refresh token.
 * Returns the new access token on success, null on failure.
 * Mutates tokenStore (setTokens) on success.
 * Concurrent callers share a single in-flight refresh request.
 */
async function tryRefreshTokens(): Promise<string | null> {
  if (!API_BASE) return null; // no FastAPI base set — nothing to refresh against

  // If a refresh is already in flight, wait for it rather than starting a new one.
  // This prevents both duplicate refresh calls AND the "immediate null → clearTokens" bug.
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<string | null> => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return null;

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      if (data.access_token) {
        // Keep existing refresh token if FastAPI doesn't rotate it
        setTokens(data.access_token, data.refresh_token ?? refreshToken);
        return data.access_token;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null; // clear so the next expiry starts a fresh refresh
    }
  })();

  return refreshPromise;
}

// ─── Request ─────────────────────────────────────────────────────────────────

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Pass JWT access token explicitly — overrides auto-inject from tokenStore */
  token?: string;
};

async function request<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, token: explicitToken, headers: extraHeaders, ...rest } =
    options;

  // ── Build headers ────────────────────────────────────────────────────────
  const headers: Record<string, string> = {
    ...(extraHeaders as Record<string, string>),
  };

  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  // Determine which token to use:
  // 1. Explicit token passed by caller (e.g. auth/me right after login)
  // 2. Auto-inject from tokenStore when we're talking to FastAPI
  // 3. Nothing (Next.js API routes authenticate via next-auth cookie)
  const token = explicitToken ?? (API_BASE ? getAccessToken() : null);
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // ── Serialize body once so we can reuse it on retry ─────────────────────
  const serializedBody =
    body instanceof FormData
      ? body
      : body !== undefined
        ? JSON.stringify(body)
        : undefined;

  // ── First attempt ────────────────────────────────────────────────────────
  const res = await fetch(url(path), {
    ...rest,
    headers,
    body: serializedBody,
  });

  // ── 401 handling: try refresh → retry ────────────────────────────────────
  // Skip refresh for auth endpoints — /auth/login and /auth/refresh are
  // unauthenticated by definition. A 401 there means wrong credentials or
  // an expired refresh token, not a stale access token. Propagate immediately.
  const isAuthEndpoint = path.startsWith("/auth/login") || path.startsWith("/auth/refresh");
  if (res.status === 401 && API_BASE && !explicitToken && !isAuthEndpoint) {

    const newToken = await tryRefreshTokens();

    if (newToken) {
      // Update the Authorization header with the fresh token
      headers["Authorization"] = `Bearer ${newToken}`;

      const retryRes = await fetch(url(path), {
        ...rest,
        headers,
        body: serializedBody,
      });

      if (!retryRes.ok) {
        return handleErrorResponse<T>(retryRes);
      }
      if (retryRes.status === 204) return {} as T;
      return retryRes.json() as Promise<T>;
    } else {
      // Refresh failed — session is unrecoverable; redirect to sign-in
      if (typeof window !== "undefined") {
        clearTokens();
        window.location.href = "/auth/signin";
      }
      throw new APIError("Session expired. Please sign in again.", 401);
    }
  }

  // ── Normal error handling ─────────────────────────────────────────────────
  if (!res.ok) {
    return handleErrorResponse<T>(res);
  }

  // 204 No Content — return empty object
  if (res.status === 204) return {} as T;

  return res.json() as Promise<T>;
}

async function handleErrorResponse<T>(res: Response): Promise<T> {
  let message = `API error ${res.status}`;
  try {
    const err = await res.json();
    message = err?.error?.message ?? err?.message ?? err?.error ?? message;
  } catch {
    // non-JSON error body — keep default message
  }
  throw new APIError(message, res.status);
}

// ─── Error class ─────────────────────────────────────────────────────────────

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "APIError";
  }
}

// ─── Client ──────────────────────────────────────────────────────────────────

export const apiClient = {
  /** Build a URL string (for use as useSWR key) */
  url,

  get: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: "GET", ...options }),

  post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: "POST", body, ...options }),

  put: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: "PUT", body, ...options }),

  patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: "PATCH", body, ...options }),

  delete: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { method: "DELETE", body, ...options }),

  /** POST with FormData (file uploads — knowledge ingestion) */
  upload: <T = unknown>(
    path: string,
    formData: FormData,
    options?: RequestOptions
  ) => request<T>(path, { method: "POST", body: formData, ...options }),

  /** Build an SSE EventSource URL (insights/sse) */
  sseUrl: (path: string) => url(path),
};

/**
 * authFetcher — drop-in SWR fetcher with full 401→refresh→retry support.
 *
 * WHY THIS DELEGATES TO apiClient.get():
 * The naive approach (fetch + Bearer header) has two critical bugs:
 *   1. If getAccessToken() returns null, it sends "Authorization: Bearer "
 *      (empty token) — FastAPI treats this as a malformed header → 401.
 *   2. If the access token is expired, the 401 is thrown directly — no
 *      attempt to refresh and retry.
 *
 * Delegating to apiClient.get() gives authFetcher the same behaviour as
 * every other imperative API call:
 *   - No Authorization header at all when no token is stored (cleaner 401)
 *   - On 401 → tryRefreshTokens() → retry with the new token
 *   - On refresh failure → clearTokens() + redirect to /auth/signin
 *
 * USAGE (unchanged — drop-in for useSWR):
 *   import { authFetcher } from "@/lib/apiClient";
 *   const { data } = useSWR(apiClient.url("/some-path"), authFetcher);
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const authFetcher = <T = any>(url: string): Promise<T> => {
  // SWR passes the full URL (e.g. "http://localhost:8000/api/v1/goals").
  // apiClient.get() expects a path (e.g. "/goals").
  // Strip the base so we can delegate and get the refresh logic for free.
  const path = API_BASE ? url.slice(API_BASE.length) : url.replace(/^\/api/, "");
  return apiClient.get<T>(path || "/");
};
