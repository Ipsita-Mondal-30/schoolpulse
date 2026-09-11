'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acknowledgeHomework,
  acknowledgeNotice,
  loadMyAcknowledgements,
  loadParentAccess,
  unacknowledgeHomework,
  unacknowledgeNotice,
  type MyAcknowledgements,
  type ParentAccessSummary,
} from '@/app/actions/acknowledgements';

export const acknowledgementsQueryKey = ['acknowledgements', 'me'] as const;
export const parentAccessQueryKey = ['parent-access', 'me'] as const;

export function useMyAcknowledgementsQuery() {
  return useQuery({
    queryKey: acknowledgementsQueryKey,
    queryFn: (): Promise<MyAcknowledgements> => loadMyAcknowledgements(),
  });
}

export function useParentAccessQuery(enabled: boolean) {
  return useQuery({
    queryKey: parentAccessQueryKey,
    queryFn: (): Promise<ParentAccessSummary> => loadParentAccess(),
    enabled,
  });
}

export function useAcknowledgeHomeworkMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uiId: string) => acknowledgeHomework(uiId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: acknowledgementsQueryKey });
    },
  });
}

export function useUnacknowledgeHomeworkMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uiId: string) => unacknowledgeHomework(uiId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: acknowledgementsQueryKey });
    },
  });
}

export function useAcknowledgeNoticeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uiId: string) => acknowledgeNotice(uiId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: acknowledgementsQueryKey });
    },
  });
}

export function useUnacknowledgeNoticeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uiId: string) => unacknowledgeNotice(uiId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: acknowledgementsQueryKey });
    },
  });
}
