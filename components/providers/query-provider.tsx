"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * Short stale window so NeverSkip → Neon writes appear quickly after sync.
 * Window-focus refetch is enabled so returning to SchoolPulse refreshes live data.
 */
export const UI_QUERY_STALE_TIME_MS = 30 * 1000;

/** Keep inactive query results around across longer browsing sessions. */
export const UI_QUERY_GC_TIME_MS = 30 * 60 * 1000;

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: UI_QUERY_STALE_TIME_MS,
        gcTime: UI_QUERY_GC_TIME_MS,
        refetchOnWindowFocus: true,
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
