"use client";

import type { ApiResponse } from "./types";

/**
 * Typed API client for the Express + MongoDB backend.
 *
 * Two modes:
 *  - LOCAL DEV (default at home): set NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
 *    in .env.local. Requests go directly to the Express server (CORS enabled).
 *  - SANDBOX (this cloud env): leave unset. Requests route through the Caddy
 *    gateway with ?XTransformPort=4000.
 *
 * Automatic Bearer-token injection + transparent single-retry refresh on 401.
 */

// Empty = sandbox gateway mode. Set NEXT_PUBLIC_BACKEND_URL for local dev.
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
const BACKEND_PORT = 4000;

const ACCESS_KEY = "emr_access_token";
const REFRESH_KEY = "emr_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}
export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}
export function setTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  auth?: boolean; // default true
  /** internal: prevent infinite refresh loop */
  _retry?: boolean;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  // Direct mode (local dev): http://localhost:4000/api/v1/...
  if (BACKEND_URL) {
    const u = new URL(`/api/v1${path}`, BACKEND_URL);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null || v === "") continue;
        u.searchParams.append(k, String(v));
      }
    }
    return u.toString();
  }
  // Sandbox gateway mode: /api/v1/...?XTransformPort=4000
  const base = `/api/v1${path}`;
  const params = new URLSearchParams({ XTransformPort: String(BACKEND_PORT) });
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      params.append(k, String(v));
    }
  }
  return `${base}?${params.toString()}`;
}

async function doFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = true, _retry } = opts;
  const url = buildUrl(path, query);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth) {
    const token = getAccessToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Transparent refresh on 401 (once).
  if (res.status === 401 && auth && !_retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return doFetch<T>(path, { ...opts, _retry: true });
    clearTokens();
    throw new ApiError(401, "Session expired. Please sign in again.", "UNAUTHORIZED");
  }

  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(res.status, `Request failed (${res.status})`);
  }
  if (!res.ok || !json.success) {
    throw new ApiError(
      res.status,
      json.message || `Request failed (${res.status})`,
      (json.meta as { code?: string } | undefined)?.code,
      (json.meta as { details?: unknown } | undefined)?.details,
    );
  }
  return json.data;
}

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const res = await fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as ApiResponse<{ accessToken: string; refreshToken: string }>;
    if (!json.success) return false;
    setTokens(json.data.accessToken, json.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

/** Public API surface. */
export const api = {
  get: <T>(path: string, query?: RequestOptions["query"]) =>
    doFetch<T>(path, { method: "GET", query }),
  post: <T>(path: string, body?: unknown, opts?: { auth?: boolean }) =>
    doFetch<T>(path, { method: "POST", body, auth: opts?.auth ?? true }),
  put: <T>(path: string, body?: unknown) => doFetch<T>(path, { method: "PUT", body }),
  del: <T>(path: string) => doFetch<T>(path, { method: "DELETE" }),
};

/** Fetch helper that also returns the pagination meta (for list views). */
export async function apiWithMeta<T>(
  path: string,
  query?: RequestOptions["query"],
): Promise<{ data: T; meta?: ApiResponse<T>["meta"] }> {
  const url = buildUrl(path, query);
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (res.status === 401) {
    if (await tryRefresh()) return apiWithMeta<T>(path, query);
    clearTokens();
    throw new ApiError(401, "Session expired");
  }
  const json = (await res.json()) as ApiResponse<T>;
  if (!res.ok || !json.success) {
    throw new ApiError(res.status, json.message, (json.meta as { code?: string } | undefined)?.code);
  }
  return { data: json.data, meta: json.meta };
}
