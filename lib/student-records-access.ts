/**
 * Attendance, report cards and fees belong to one child. Sign-up is open and every
 * parent account is auto-linked to the synced child, so these records additionally
 * require the signed-in email to be listed in STUDENT_RECORDS_EMAILS (comma-separated).
 */

export function parseStudentRecordsEmails(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export type StudentRecordsAccess = 'allowed' | 'signed_out' | 'not_configured' | 'not_allowed';

export function studentRecordsAccess(
  email: string | null | undefined,
  allowlistRaw: string | undefined,
): StudentRecordsAccess {
  if (!email) return 'signed_out';
  const allowed = parseStudentRecordsEmails(allowlistRaw);
  if (allowed.length === 0) return 'not_configured';
  return allowed.includes(email.trim().toLowerCase()) ? 'allowed' : 'not_allowed';
}
