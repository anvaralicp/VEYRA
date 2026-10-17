/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSafeRedirectUrl, isPlatformAdminRoute } from '../src/lib/auth/redirect';
import { getPlatformAdminEmails, isPlatformAdmin } from '../src/lib/auth/platform';
import { loginAction } from '../src/app/login/actions';
import { hashPassword } from '../src/lib/auth/password';
import { middleware } from '../src/middleware';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';

const {
  mockCookiesStore,
  mockUserFindUnique,
  mockTenantMemberFindMany,
  mockRedirect,
} = vi.hoisted(() => ({
  mockCookiesStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  mockUserFindUnique: vi.fn(),
  mockTenantMemberFindMany: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookiesStore),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    mockRedirect(url);
    const err = new Error('NEXT_REDIRECT');
    (err as any).digest = `NEXT_REDIRECT;replace;${url};307;;`;
    throw err;
  }),
}));

vi.mock('../src/prisma/db', () => ({
  db: {
    orm: {
      public: {
        TenantMember: {
          where: vi.fn(() => ({
            first: mockTenantMemberFindMany,
            all: mockTenantMemberFindMany,
          })),
          all: mockTenantMemberFindMany,
        },
        User: {
          where: vi.fn(() => ({
            first: mockUserFindUnique,
          })),
        },
      },
    },
    TenantMember: {
      findMany: mockTenantMemberFindMany,
    },
    tenantMember: {
      findMany: mockTenantMemberFindMany,
    },
    User: {
      findUnique: mockUserFindUnique,
    },
    AuditLog: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'mock-audit' })),
    },
    auditLog: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'mock-audit' })),
    },
  },
}));

describe('Platform Admin & Safe Login Redirect Suite', () => {
  const originalEnv = process.env.PLATFORM_ADMIN_EMAILS;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookiesStore.get.mockReturnValue(undefined);
  });

  afterEach(() => {
    process.env.PLATFORM_ADMIN_EMAILS = originalEnv;
  });

  describe('1. Platform Admin Email Allowlist & Quote Normalization', () => {
    it('normalizes single quoted and double quoted email values correctly', () => {
      process.env.PLATFORM_ADMIN_EMAILS = '"admin@veyra.io"';
      let emails = getPlatformAdminEmails();
      expect(emails.has('admin@veyra.io')).toBe(true);

      process.env.PLATFORM_ADMIN_EMAILS = "'ops@veyra.io'";
      emails = getPlatformAdminEmails();
      expect(emails.has('ops@veyra.io')).toBe(true);
    });

    it('handles multiple quoted emails with spaces and mixed quotes without weakening allowlist', () => {
      process.env.PLATFORM_ADMIN_EMAILS = ' "ops-1@veyra.io" , \'ops-2@veyra.io\' , "ops-3@veyra.io" ';
      const emails = getPlatformAdminEmails();
      expect(emails.has('ops-1@veyra.io')).toBe(true);
      expect(emails.has('ops-2@veyra.io')).toBe(true);
      expect(emails.has('ops-3@veyra.io')).toBe(true);
      expect(emails.has('attacker@evil.com')).toBe(false);
      expect(emails.size).toBe(3);
    });

    it('handles entire environment variable wrapped in quotes with multiple entries', () => {
      process.env.PLATFORM_ADMIN_EMAILS = '"first@veyra.io, second@veyra.io"';
      const emails = getPlatformAdminEmails();
      expect(emails.has('first@veyra.io')).toBe(true);
      expect(emails.has('second@veyra.io')).toBe(true);
    });

    it('correctly checks isPlatformAdmin with quoted allowlist', async () => {
      process.env.PLATFORM_ADMIN_EMAILS = '"superadmin@veyra.io"';
      expect(await isPlatformAdmin({ email: 'superadmin@veyra.io' })).toBe(true);
      expect(await isPlatformAdmin({ email: 'SUPERADMIN@VEYRA.IO' })).toBe(true);
      expect(await isPlatformAdmin({ email: 'regular@tenant.io' })).toBe(false);
    });
  });

  describe('2. Safe Redirect URL Sanitization (getSafeRedirectUrl)', () => {
    it('allows valid relative local paths, query strings, and hashes', () => {
      expect(getSafeRedirectUrl('/dashboard')).toBe('/dashboard');
      expect(getSafeRedirectUrl('/platform-admin')).toBe('/platform-admin');
      expect(getSafeRedirectUrl('/platform-admin/tenants?page=2&q=acme#section')).toBe(
        '/platform-admin/tenants?page=2&q=acme#section'
      );
      expect(getSafeRedirectUrl('/commercial/orders?status=active')).toBe('/commercial/orders?status=active');
    });

    it('distinguishes /platform-admin and /platform-admin/ from /platform-administrator', () => {
      expect(isPlatformAdminRoute('/platform-admin')).toBe(true);
      expect(isPlatformAdminRoute('/platform-admin/')).toBe(true);
      expect(isPlatformAdminRoute('/platform-admin/tenants')).toBe(true);
      expect(isPlatformAdminRoute('/platform-admin/tenants?page=2&q=test')).toBe(true);
      expect(isPlatformAdminRoute('/platform-administrator')).toBe(false);
      expect(isPlatformAdminRoute('/platform-administrator/settings')).toBe(false);
      expect(isPlatformAdminRoute('/platform-admin-portal')).toBe(false);
      expect(isPlatformAdminRoute('/dashboard')).toBe(false);
    });

    it('rejects external absolute URLs and returns fallback', () => {
      expect(getSafeRedirectUrl('https://evil.com', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('http://evil.com/path', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('ftp://evil.com', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('javascript:alert(1)', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('data:text/html,<script>alert(1)</script>', '/fallback')).toBe('/fallback');
    });

    it('rejects protocol-relative URLs (//) and returns fallback', () => {
      expect(getSafeRedirectUrl('//evil.com', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('///evil.com', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('//localhost', '/fallback')).toBe('/fallback');
    });

    it('rejects backslash bypasses (\\) and returns fallback', () => {
      expect(getSafeRedirectUrl('/\\evil.com', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('/\\/evil.com', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('/foo\\bar', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('\\\\evil.com', '/fallback')).toBe('/fallback');
    });

    it('rejects CRLF and control characters to prevent header injection', () => {
      expect(getSafeRedirectUrl('/dashboard\r\nSet-Cookie: session=evil', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('/dashboard\nSet-Cookie: session=evil', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('/dashboard\x00evil', '/fallback')).toBe('/fallback');
    });

    it('rejects recursive auth loops (/login, /register)', () => {
      expect(getSafeRedirectUrl('/login', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('/LOGIN', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('/register', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('/login?redirectTo=/platform-admin', '/fallback')).toBe('/fallback');
    });

    it('handles non-string, empty, and null values gracefully', () => {
      expect(getSafeRedirectUrl(null, '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl(undefined, '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl('   ', '/fallback')).toBe('/fallback');
      expect(getSafeRedirectUrl(12345, '/fallback')).toBe('/fallback');
    });
  });

  describe('3. Login Action Platform Admin & Tenant Routing Boundaries', () => {
    beforeEach(() => {
      process.env.PLATFORM_ADMIN_EMAILS = 'admin@veyra.io';
    });

    it('redirects platform admin directly to /platform-admin when requested, even with 0 tenant memberships', async () => {
      const hashedPassword = await hashPassword('securePass123');
      mockUserFindUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@veyra.io',
        password_hash: hashedPassword,
        status: 'ACTIVE',
      });
      mockTenantMemberFindMany.mockResolvedValue([]);

      const formData = new FormData();
      formData.append('email', 'admin@veyra.io');
      formData.append('password', 'securePass123');
      formData.append('redirectTo', '/platform-admin');

      await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT');
      expect(mockRedirect).toHaveBeenCalledWith('/platform-admin');
    });

    it('redirects platform admin directly to /platform-admin when requested, even with 1 tenant membership', async () => {
      const hashedPassword = await hashPassword('securePass123');
      mockUserFindUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@veyra.io',
        password_hash: hashedPassword,
        status: 'ACTIVE',
      });
      mockTenantMemberFindMany.mockResolvedValue([
        { tenant_id: 'tenant-1', role: 'MEMBER' },
      ]);

      const formData = new FormData();
      formData.append('email', 'admin@veyra.io');
      formData.append('password', 'securePass123');
      formData.append('redirectTo', '/platform-admin');

      await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT');
      expect(mockRedirect).toHaveBeenCalledWith('/platform-admin');
    });

    it('redirects platform admin directly to /platform-admin when requested, even with multiple tenant memberships (no /select-tenant)', async () => {
      const hashedPassword = await hashPassword('securePass123');
      mockUserFindUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@veyra.io',
        password_hash: hashedPassword,
        status: 'ACTIVE',
      });
      mockTenantMemberFindMany.mockResolvedValue([
        { tenant_id: 'tenant-1', role: 'MEMBER' },
        { tenant_id: 'tenant-2', role: 'ADMIN' },
      ]);

      const formData = new FormData();
      formData.append('email', 'admin@veyra.io');
      formData.append('password', 'securePass123');
      formData.append('redirectTo', '/platform-admin');

      await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT');
      expect(mockRedirect).toHaveBeenCalledWith('/platform-admin');
      expect(mockRedirect).not.toHaveBeenCalledWith('/select-tenant');
    });

    it('redirects platform admin to /platform-admin when logging in without redirectTo and has 0 memberships', async () => {
      const hashedPassword = await hashPassword('securePass123');
      mockUserFindUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@veyra.io',
        password_hash: hashedPassword,
        status: 'ACTIVE',
      });
      mockTenantMemberFindMany.mockResolvedValue([]);

      const formData = new FormData();
      formData.append('email', 'admin@veyra.io');
      formData.append('password', 'securePass123');

      await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT');
      expect(mockRedirect).toHaveBeenCalledWith('/platform-admin');
    });

    it('redirects platform admin with 1 membership to tenant workspace when no redirectTo is provided', async () => {
      const hashedPassword = await hashPassword('securePass123');
      mockUserFindUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@veyra.io',
        password_hash: hashedPassword,
        status: 'ACTIVE',
      });
      mockTenantMemberFindMany.mockResolvedValue([
        { tenant_id: 'tenant-internal', role: 'ADMIN' },
      ]);

      const formData = new FormData();
      formData.append('email', 'admin@veyra.io');
      formData.append('password', 'securePass123');

      await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT');
      expect(mockCookiesStore.set).toHaveBeenCalledWith('active_tenant_id', 'tenant-internal', expect.any(Object));
      expect(mockRedirect).toHaveBeenCalledWith('/');
    });

    it('redirects platform admin directly to /platform-admin/tenants when requested', async () => {
      const hashedPassword = await hashPassword('securePass123');
      mockUserFindUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@veyra.io',
        password_hash: hashedPassword,
        status: 'ACTIVE',
      });
      mockTenantMemberFindMany.mockResolvedValue([
        { tenant_id: 'tenant-1', role: 'MEMBER' },
      ]);

      const formData = new FormData();
      formData.append('email', 'admin@veyra.io');
      formData.append('password', 'securePass123');
      formData.append('redirectTo', '/platform-admin/tenants?page=2');

      await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT');
      expect(mockRedirect).toHaveBeenCalledWith('/platform-admin/tenants?page=2');
    });

    it('does NOT treat /platform-administrator as platform-admin: routes admin with tenant membership to tenant route', async () => {
      const hashedPassword = await hashPassword('securePass123');
      mockUserFindUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@veyra.io',
        password_hash: hashedPassword,
        status: 'ACTIVE',
      });
      mockTenantMemberFindMany.mockResolvedValue([
        { tenant_id: 'tenant-internal', role: 'ADMIN' },
      ]);

      const formData = new FormData();
      formData.append('email', 'admin@veyra.io');
      formData.append('password', 'securePass123');
      formData.append('redirectTo', '/platform-administrator');

      await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT');
      expect(mockCookiesStore.set).toHaveBeenCalledWith('active_tenant_id', 'tenant-internal', expect.any(Object));
      expect(mockRedirect).toHaveBeenCalledWith('/platform-administrator');
    });

    it('redirects ordinary user attempting /platform-admin to tenant dashboard or selection, never platform-admin', async () => {
      const hashedPassword = await hashPassword('userPass123');
      mockUserFindUnique.mockResolvedValue({
        id: 'user-regular',
        email: 'regular@tenant.io',
        password_hash: hashedPassword,
        status: 'ACTIVE',
      });
      mockTenantMemberFindMany.mockResolvedValue([
        { tenant_id: 'tenant-user', role: 'MEMBER' },
      ]);

      const formData = new FormData();
      formData.append('email', 'regular@tenant.io');
      formData.append('password', 'userPass123');
      formData.append('redirectTo', '/platform-admin');

      await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT');
      // For ordinary user, /platform-admin is sanitized to default ('/')
      expect(mockRedirect).toHaveBeenCalledWith('/');
      expect(mockRedirect).not.toHaveBeenCalledWith('/platform-admin');
    });

    it('sanitizes ordinary user attempting /platform-admin/tenants to default', async () => {
      const hashedPassword = await hashPassword('userPass123');
      mockUserFindUnique.mockResolvedValue({
        id: 'user-regular',
        email: 'regular@tenant.io',
        password_hash: hashedPassword,
        status: 'ACTIVE',
      });
      mockTenantMemberFindMany.mockResolvedValue([
        { tenant_id: 'tenant-user', role: 'MEMBER' },
      ]);

      const formData = new FormData();
      formData.append('email', 'regular@tenant.io');
      formData.append('password', 'userPass123');
      formData.append('redirectTo', '/platform-admin/tenants?page=2');

      await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT');
      expect(mockRedirect).toHaveBeenCalledWith('/');
      expect(mockRedirect).not.toHaveBeenCalledWith('/platform-admin/tenants?page=2');
    });

    it('does NOT sanitize /platform-administrator for ordinary user: preserves destination as tenant route', async () => {
      const hashedPassword = await hashPassword('userPass123');
      mockUserFindUnique.mockResolvedValue({
        id: 'user-regular',
        email: 'regular@tenant.io',
        password_hash: hashedPassword,
        status: 'ACTIVE',
      });
      mockTenantMemberFindMany.mockResolvedValue([
        { tenant_id: 'tenant-user', role: 'MEMBER' },
      ]);

      const formData = new FormData();
      formData.append('email', 'regular@tenant.io');
      formData.append('password', 'userPass123');
      formData.append('redirectTo', '/platform-administrator');

      await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT');
      expect(mockCookiesStore.set).toHaveBeenCalledWith('active_tenant_id', 'tenant-user', expect.any(Object));
      expect(mockRedirect).toHaveBeenCalledWith('/platform-administrator');
    });

    it('neutralizes malicious open redirect attempts in loginAction', async () => {
      const hashedPassword = await hashPassword('userPass123');
      mockUserFindUnique.mockResolvedValue({
        id: 'user-regular',
        email: 'regular@tenant.io',
        password_hash: hashedPassword,
        status: 'ACTIVE',
      });
      mockTenantMemberFindMany.mockResolvedValue([
        { tenant_id: 'tenant-user', role: 'MEMBER' },
      ]);

      const formData = new FormData();
      formData.append('email', 'regular@tenant.io');
      formData.append('password', 'userPass123');
      formData.append('redirectTo', 'https://attacker.com/steal');

      await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT');
      expect(mockRedirect).toHaveBeenCalledWith('/');
      expect(mockRedirect).not.toHaveBeenCalledWith('https://attacker.com/steal');
    });
  });

  describe('4. Middleware Destination Preservation & Sanitization', () => {
    const secretKey = new TextEncoder().encode(
      process.env.SESSION_SECRET || 'default_super_secret_key_for_development_only'
    );

    it('preserves protected destination with query string when unauthenticated user is redirected to /login', async () => {
      const request = new NextRequest('http://localhost:3000/platform-admin/tenants?page=2&q=acme');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      const redirectLocation = response.headers.get('location');
      expect(redirectLocation).toBeDefined();

      const url = new URL(redirectLocation!);
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('redirectTo')).toBe('/platform-admin/tenants?page=2&q=acme');
    });

    it('preserves clean protected destination /platform-admin for unauthenticated user', async () => {
      const request = new NextRequest('http://localhost:3000/platform-admin');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      const redirectLocation = response.headers.get('location');
      const url = new URL(redirectLocation!);
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('redirectTo')).toBe('/platform-admin');
    });

    it('redirects authenticated user accessing /login with valid redirectTo to that destination', async () => {
      const sessionToken = await new SignJWT({ userId: 'admin-1', email: 'admin@veyra.io' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('24h')
        .sign(secretKey);

      const request = new NextRequest('http://localhost:3000/login?redirectTo=%2Fplatform-admin', {
        headers: {
          cookie: `session=${sessionToken}`,
        },
      });

      const response = await middleware(request);
      expect(response.status).toBe(307);
      const redirectLocation = response.headers.get('location');
      const url = new URL(redirectLocation!);
      expect(url.pathname).toBe('/platform-admin');
    });

    it('neutralizes malicious redirectTo for authenticated user accessing /login and defaults to /dashboard', async () => {
      const sessionToken = await new SignJWT({ userId: 'user-1', email: 'user@tenant.io' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('24h')
        .sign(secretKey);

      const request = new NextRequest('http://localhost:3000/login?redirectTo=https://attacker.com', {
        headers: {
          cookie: `session=${sessionToken}`,
        },
      });

      const response = await middleware(request);
      expect(response.status).toBe(307);
      const redirectLocation = response.headers.get('location');
      const url = new URL(redirectLocation!);
      expect(url.pathname).toBe('/dashboard');
    });
  });
});
