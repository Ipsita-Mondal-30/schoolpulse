import type { NeverSkipRawAssignment } from './types';

export type HomeworkClassifyResult = 'homework' | 'skip';

/** Rule-based classifier — prefer API type over LLM. */
export function classifyAssignment(raw: NeverSkipRawAssignment): HomeworkClassifyResult {
  const typ = String(raw.assign_typ ?? '').trim().toLowerCase();
  if (typ === 'homework') return 'homework';
  return 'skip';
}

export function classifyNotice(): 'notice' {
  return 'notice';
}
