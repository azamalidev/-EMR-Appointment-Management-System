"use client";

import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";

/**
 * Shared React Query `meta`-style error handler: shows a toast for failed
 * queries (except 401s, which the api-client handles via refresh/logout).
 */
export const apiClientError = {
  onError: (err: unknown) => {
    const e = err as ApiError;
    if (e?.status === 401) return; // handled by client (logout)
    toast.error(e?.message || "Something went wrong");
  },
};

export function mutationError(err: unknown): string {
  const e = err as ApiError;
  return e?.message || "Operation failed";
}
