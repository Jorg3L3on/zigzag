import { NextRequest, NextResponse } from 'next/server';

const LOGIN_PATH = '/login';
const DASHBOARD_PATH = '/dashboard';

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
  const isOnDashboard = pathname.startsWith(DASHBOARD_PATH);
  const isOnRoot = pathname === '/';
  const isOnLogin = pathname === LOGIN_PATH;
  const isLoggedIn = hasSessionCookie(request);

  if ((isOnDashboard || isOnRoot) && !isLoggedIn) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  if (isOnLogin && isLoggedIn) {
    return NextResponse.redirect(new URL(DASHBOARD_PATH, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|apple-touch-icon.png|manifest.webmanifest|icons/).*)',
  ],
};
