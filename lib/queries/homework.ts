"use client";

import { useQuery } from "@tanstack/react-query";
import { loadHomeworkForUi } from "@/app/actions";
import type { UiHomeworkItem } from "@/lib/ui-merge";

export const homeworkQueryKey = ["homework"] as const;

export type HomeworkQueryData = {
  items: UiHomeworkItem[];
  fromSheet: boolean;
};

export async function fetchHomeworkForUi(): Promise<HomeworkQueryData> {
  const result = await loadHomeworkForUi();
  return {
    items: result.items as UiHomeworkItem[],
    fromSheet: result.fromSheet,
  };
}

export function useHomeworkQuery() {
  return useQuery({
    queryKey: homeworkQueryKey,
    queryFn: fetchHomeworkForUi,
  });
}
