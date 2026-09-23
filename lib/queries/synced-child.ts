'use client';

import { useSession } from 'next-auth/react';
import { useParentAccessQuery } from '@/lib/queries/acknowledgements';
import { isClass1Section, type Class1Section } from '@/lib/class-sections';

/** Fallback when guest / link still resolving — matches historical single-family sync. */
export const FALLBACK_SYNCED_SECTION: Class1Section = 'I-A';

/**
 * Section for the currently synced child. No parent-facing Class/Section picker.
 */
export function useSyncedChildSection(): {
  section: Class1Section;
  studentName: string | null;
  hasApprovedLink: boolean;
  isLoading: boolean;
} {
  const { data: session, status } = useSession();
  const isParent = session?.user?.role === 'parent';
  const { data: access, isLoading } = useParentAccessQuery(Boolean(isParent));

  const raw = access?.primarySection?.trim() || FALLBACK_SYNCED_SECTION;
  const section: Class1Section = isClass1Section(raw) ? raw : FALLBACK_SYNCED_SECTION;

  return {
    section,
    studentName: access?.studentName ?? null,
    hasApprovedLink: Boolean(access?.hasApprovedLink),
    isLoading: status === 'loading' || (isParent && isLoading),
  };
}
