"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Parent UI cache: reuse Neon-backed payloads across navigation.
 * Refetch when data is stale on mount (after sync), but never on window focus.
 */
export const UI_QUERY_STALE_TIME_MS = 5 * 60 * 1000;

/** Keep inactive query results around across longer browsing sessions. */
export const UI_QUERY_GC_TIME_MS = 30 * 60 * 1000;

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: UI_QUERY_STALE_TIME_MS,
        gcTime: UI_QUERY_GC_TIME_MS,
        refetchOnWindowFocus: false,
        // Default TanStack behavior: refetch on mount only when stale.
        // Do NOT force false — that freezes pre-sync notice/update payloads forever.
        refetchOnMount: true,
        retry: 1,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // One client per browser session so Homework / Notices share cache.
  const [client] = useState(() => makeQueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
