"use client";

import { QueryClient, defaultShouldDehydrateQuery, type Query } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState, type ReactNode } from "react";
import { useSchoolPulseDataVersionSync } from "@/lib/queries/data-version";

/**
 * Parent UI cache: reuse Neon-backed payloads across navigation and refresh.
 * Refetch when data is stale on mount (after sync), but never on window focus.
 */
export const UI_QUERY_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Keep inactive + persisted query results for 24h so localStorage restore
 * is not immediately GC'd (must be ≥ UI_QUERY_PERSIST_MAX_AGE_MS).
 */
export const UI_QUERY_GC_TIME_MS = 24 * 60 * 60 * 1000;

/** How long restored disk cache is eligible to hydrate the client. */
export const UI_QUERY_PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const UI_QUERY_PERSIST_KEY = "schoolpulse-query-cache";

/** Bump when persisted query payload shapes change. */
export const UI_QUERY_PERSIST_BUSTER = "v1";

/**
 * School-content query keys safe to persist across refresh.
 * Auth-scoped keys (parent-access, acknowledgements) are intentionally excluded.
 */
export const UI_PERSIST_QUERY_ROOTS = [
  "homework",
  "notices",
  "updates-feed",
  "canonical-schedule",
  "jol",
  "this-week",
  "changes",
] as const;

export function shouldPersistUiQuery(query: Query): boolean {
  const root = query.queryKey[0];
  if (typeof root !== "string") return false;
  if (!(UI_PERSIST_QUERY_ROOTS as readonly string[]).includes(root)) return false;
  return defaultShouldDehydrateQuery(query);
}

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

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function makePersister() {
  return createSyncStoragePersister({
    storage:
      typeof window !== "undefined" ? window.localStorage : noopStorage,
    key: UI_QUERY_PERSIST_KEY,
  });
}

/** Clear in-memory QueryClient + disk cache (call before sign-out). */
export function clearPersistedUiQueryCache(client?: QueryClient) {
  client?.clear();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(UI_QUERY_PERSIST_KEY);
    } catch {
      // ignore quota / private-mode failures
    }
  }
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // One client per browser session so Homework / Notices share cache.
  const [client] = useState(() => makeQueryClient());
  const [persister] = useState(() => makePersister());

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: UI_QUERY_PERSIST_MAX_AGE_MS,
        buster: UI_QUERY_PERSIST_BUSTER,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistUiQuery,
        },
      }}
    >
      <SchoolPulseDataVersionBridge />
      {children}
    </PersistQueryClientProvider>
  );
}

function SchoolPulseDataVersionBridge() {
  useSchoolPulseDataVersionSync();
  return null;
}
