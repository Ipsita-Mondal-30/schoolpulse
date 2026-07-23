// ─────────────────────────────────────────────────────────────
//  MAINTENANCE / TEMPORARY OFFLINE SWITCH
//
//  While this is `true`, the whole app is blocked EXCEPT for
//  the two allowed routes below. Everything else (and /api/chat)
//  redirects to the friendly /maintenance page.
//
//  ▶ To bring the app fully back online: set this to `false`
//    (and redeploy). Nothing else needs to change.
// ─────────────────────────────────────────────────────────────
export const MAINTENANCE_MODE = true;

// Routes that stay accessible while in maintenance mode.
export const MAINTENANCE_ALLOWED_PATHS = ['/info', '/dates', '/maintenance'];

// True when the given pathname is allowed during maintenance.
export function isAllowedDuringMaintenance(pathname: string): boolean {
  return MAINTENANCE_ALLOWED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
