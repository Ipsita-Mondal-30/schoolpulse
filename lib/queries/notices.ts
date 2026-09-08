"use client";

import { useQuery } from "@tanstack/react-query";
import { loadNoticesForUi } from "@/app/actions";
import type { UiNoticeItem } from "@/lib/ui-merge";

export const noticesQueryKey = ["notices"] as const;

export type NoticesQueryData = UiNoticeItem[];

export async function fetchNoticesForUi(): Promise<NoticesQueryData> {
  return loadNoticesForUi();
}

export function useNoticesQuery() {
  return useQuery({
    queryKey: noticesQueryKey,
    queryFn: fetchNoticesForUi,
  });
}
