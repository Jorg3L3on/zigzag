import { NextRequest, NextResponse } from 'next/server';
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from '@/lib/request-context';

const LOGIN_PATH = '/login';
const DASHBOARD_PATH = '/dashboard';
const PROTECTED_PATH_PREFIXES = [
  DASHBOARD_PATH,
  '/account',
  '/audit',
  '/clients',
  '/companies',
  '/forbidden',
  '/operator-console',
  '/permissions',
  '/roles',
  '/service-schedules',
  '/services',
  '/tickets',
  '/users',
];

const SESSION_COOKIE_NAMES = [
  'zigzag.session-token',
  '__Secure-zigzag.session-token',
];

const hasSessionCookie = (request: NextRequest) => {
  return SESSION_COOKIE_NAMES.some((cookieName) =>
    Boolean(request.cookies.get(cookieName)?.value),
  );
};

const withRequestIdHeaders = (requestId: string, response: NextResponse) => {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
};

const nextWithRequestId = (request: NextRequest, requestId: string) => {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  return withRequestIdHeaders(
    requestId,
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
  );
};

export function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));
  const pathname = request.nextUrl.pathname;

  // API routes: attach correlation id only — auth stays in route handlers.
  if (pathname.startsWith('/api/')) {
    return nextWithRequestId(request, requestId);
  }

  if (pathname.startsWith(`${DASHBOARD_PATH}/`)) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.pathname = pathname.replace(DASHBOARD_PATH, '') || DASHBOARD_PATH;
    return withRequestIdHeaders(requestId, NextResponse.redirect(canonicalUrl));
  }

  const isOnProtectedAppRoute = PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isOnRoot = pathname === '/';
  const isLoggedIn = hasSessionCookie(request);

  if ((isOnProtectedAppRoute || isOnRoot) && !isLoggedIn) {
    return withRequestIdHeaders(
      requestId,
      NextResponse.redirect(new URL(LOGIN_PATH, request.url)),
    );
  }

  return nextWithRequestId(request, requestId);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|apple-touch-icon.png|manifest.webmanifest|icons/|serwist/).*)',
  ],
};
