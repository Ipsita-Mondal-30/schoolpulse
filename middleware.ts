import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Do not lock the app. Only redirect signed-in users away from /login.
 * Acknowledgement authorization is enforced in server actions.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname !== '/login') {
    return NextResponse.next();
  }

  // Auth.js session cookie names (secure / non-secure)
  const hasSession =
    request.cookies.has('authjs.session-token') ||
    request.cookies.has('__Secure-authjs.session-token');

  if (hasSession) {
    const next = request.nextUrl.searchParams.get('next') || '/homework';
    const url = request.nextUrl.clone();
    url.pathname = next.startsWith('/') ? next : '/homework';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login'],
};
