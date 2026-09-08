"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Matches the previous ui-data-cache TTL: Homework ↔ Notices remounts reuse
 * fresh data for 5 minutes, then allow a refetch so NeverSkip DB writes appear.
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
        // Avoid surprise refetches when parents switch browser tabs.
        refetchOnWindowFocus: false,
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
