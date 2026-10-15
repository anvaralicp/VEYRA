import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

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

  // Exclude static assets and api routes if needed
  if (path.startsWith('/_next') || path.startsWith('/favicon.ico')) {
    return NextResponse.next();
  }

  const isPublicRoute = path === '/login' || path === '/register' || path.startsWith('/invite');

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

  if (!isAuthenticated && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthenticated && (path === '/login' || path === '/register')) {
    return NextResponse.redirect(new URL('/', request.url));
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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
