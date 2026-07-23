import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { MAINTENANCE_MODE, isAllowedDuringMaintenance } from '@/lib/maintenance';

export function middleware(request: NextRequest) {
  // App is live — do nothing.
  if (!MAINTENANCE_MODE) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow the whitelisted pages (Info, Events) and the maintenance page itself.
  if (isAllowedDuringMaintenance(pathname)) {
    return NextResponse.next();
  }

  // Everything else — including /api/* — goes to the friendly message.
  const url = request.nextUrl.clone();
  url.pathname = '/maintenance';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Run on all routes except Next internals and static assets, so the
  // maintenance page keeps its styling and images load normally.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
