import { NextRequest, NextResponse } from 'next/server';

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

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith(`${DASHBOARD_PATH}/`)) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.pathname = pathname.replace(DASHBOARD_PATH, '') || DASHBOARD_PATH;
    return NextResponse.redirect(canonicalUrl);
  }

  const isOnProtectedAppRoute = PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isOnRoot = pathname === '/';
  const isLoggedIn = hasSessionCookie(request);

  if ((isOnProtectedAppRoute || isOnRoot) && !isLoggedIn) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|apple-touch-icon.png|manifest.webmanifest|icons/).*)',
  ],
};
