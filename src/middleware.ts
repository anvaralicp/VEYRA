import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getSafeRedirectUrl } from './lib/auth/redirect';

function getSecretKey() {
  let secretKey = process.env.SESSION_SECRET;
  if (!secretKey) {
    if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
      secretKey = "default_super_secret_key_for_development_only";
    } else {
      throw new Error("SESSION_SECRET is not defined in production environment.");
    }
  }
  return new TextEncoder().encode(secretKey);
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Exclude static assets and api routes
  if (
    path.startsWith('/_next') ||
    path.startsWith('/brand') ||
    path === '/favicon.ico' ||
    path === '/icon-192.png' ||
    path === '/icon-512.png'
  ) {
    return NextResponse.next();
  }

  // Publicly accessible pages without requiring session
  const isPublicRoute =
    path === '/' ||
    path === '/pricing' ||
    path === '/contact-sales' ||
    path === '/terms' ||
    path === '/privacy' ||
    path === '/login' ||
    path === '/register' ||
    path.startsWith('/invite');

  const sessionToken = request.cookies.get('session')?.value;
  let isAuthenticated = false;

  if (sessionToken) {
    try {
      await jwtVerify(sessionToken, getSecretKey(), { algorithms: ["HS256"] });
      isAuthenticated = true;
    } catch {
      // Invalid token
    }
  }

  // Unauthenticated user trying to access protected route -> redirect to login
  if (!isAuthenticated && !isPublicRoute) {
    const loginUrl = new URL('/login', request.url);
    const destination = request.nextUrl.search ? `${path}${request.nextUrl.search}` : path;
    const safeDestination = getSafeRedirectUrl(destination, '/dashboard');
    loginUrl.searchParams.set('redirectTo', safeDestination);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated user trying to access login or register -> redirect to destination or dashboard
  if (isAuthenticated && (path === '/login' || path === '/register')) {
    const rawRedirectTo = request.nextUrl.searchParams.get('redirectTo');
    const safeDestination = getSafeRedirectUrl(rawRedirectTo, '/dashboard');
    return NextResponse.redirect(new URL(safeDestination, request.url));
  }

  const requestHeaders = new Headers(request.headers);
  const activeTenantId = request.cookies.get('active_tenant_id')?.value;
  if (activeTenantId) {
    requestHeaders.set('x-tenant-id', activeTenantId);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png).*)'],
};
