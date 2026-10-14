import { createHash, timingSafeEqual } from 'crypto';

/** Server-side check of the admin token (ADMIN_HEALTH_TOKEN). Unset env rejects everything. */
export function verifyAdminToken(provided: string | null | undefined): boolean {
  const expected = process.env.ADMIN_HEALTH_TOKEN?.trim();
  if (!expected || !provided) return false;
  const a = createHash('sha256').update(provided.trim()).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
