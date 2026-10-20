/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTenantContext } from '../src/lib/tenant/context';
import { switchTenantAction } from '../src/app/select-tenant/actions';
import { logoutAction, loginAction } from '../src/app/login/actions';
import { encrypt } from '../src/lib/auth/jwt';
import { hashPassword } from '../src/lib/auth/password';

const {
  mockCookiesStore,
  mockHeadersStore,
  mockTenantMemberFindUnique,
  mockTenantMemberFindMany,
  mockUserFindUnique,
  mockAuditLogFindMany,
  mockRedirect,
} = vi.hoisted(() => ({
  mockCookiesStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  mockHeadersStore: {
    get: vi.fn(),
  },
  mockTenantMemberFindUnique: vi.fn(),
  mockTenantMemberFindMany: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockAuditLogFindMany: vi.fn(),
  mockRedirect: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookiesStore),
  headers: vi.fn(async () => mockHeadersStore),
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
            first: mockTenantMemberFindUnique,
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
      findUnique: mockTenantMemberFindUnique,
      findMany: mockTenantMemberFindMany,
    },
    tenantMember: {
      findUnique: mockTenantMemberFindUnique,
      findMany: mockTenantMemberFindMany,
    },
    User: {
      findUnique: mockUserFindUnique,
    },
    AuditLog: {
      findMany: mockAuditLogFindMany,
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'mock-audit' })),
    },
    auditLog: {
      findMany: mockAuditLogFindMany,
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: 'mock-audit' })),
    },
  },
}));

describe('Tenant Context & Session Resolution Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookiesStore.get.mockReturnValue(undefined);
    mockAuditLogFindMany.mockImplementation(async (args: any) => {
      if (args?.where?.entity === "TenantSubscription") {
        return [
          {
            created_at: new Date(),
            details: JSON.stringify({
              selectedPlanId: "trial",
              selectedPlanName: "7 Day Trial",
              trialStartUtc: new Date().toISOString(),
              trialEndUtc: new Date(Date.now() + 7 * 86400000).toISOString(),
            }),
          },
        ];
      }
      return [];
    });
  });

  describe('1. Single Active Tenant Auto-Resolution', () => {
    it('resolves tenant automatically when user has exactly one active membership and no hint is present', async () => {
      const token = await encrypt({ userId: 'user-single', email: 'single@example.com' });
      mockCookiesStore.get.mockImplementation((name) => {
        if (name === 'session') return { value: token };
        return undefined;
      });

      mockTenantMemberFindMany.mockResolvedValue([
        { id: 'mem-1', user_id: 'user-single', tenant_id: 'tenant-solo', role: 'OWNER', status: 'ACTIVE' },
      ]);

      const context = await getTenantContext();

      expect(context.tenantId).toBe('tenant-solo');
      expect(context.userId).toBe('user-single');
      expect(context.role).toBe('OWNER');
    });
  });

  describe('2. Multi-Tenant Safe Selection & Switching', () => {
    it('redirects to /select-tenant when user has multiple memberships and no active tenant is selected', async () => {
      const token = await encrypt({ userId: 'user-multi', email: 'multi@example.com' });
      mockCookiesStore.get.mockImplementation((name) => {
        if (name === 'session') return { value: token };
        return undefined;
      });

      mockTenantMemberFindMany.mockResolvedValue([
        { id: 'mem-1', user_id: 'user-multi', tenant_id: 'tenant-alpha', role: 'ADMIN', status: 'ACTIVE' },
        { id: 'mem-2', user_id: 'user-multi', tenant_id: 'tenant-beta', role: 'MEMBER', status: 'ACTIVE' },
      ]);

      await expect(getTenantContext()).rejects.toThrow('NEXT_REDIRECT');
      expect(mockRedirect).toHaveBeenCalledWith('/select-tenant');
    });

    it('resolves the selected tenant when a valid active_tenant_id cookie is present for multi-tenant user', async () => {
      const token = await encrypt({ userId: 'user-multi', email: 'multi@example.com' });
      mockCookiesStore.get.mockImplementation((name) => {
        if (name === 'session') return { value: token };
        if (name === 'active_tenant_id') return { value: 'tenant-beta' };
        return undefined;
      });

      mockTenantMemberFindUnique.mockResolvedValue({
        id: 'mem-2',
        user_id: 'user-multi',
        tenant_id: 'tenant-beta',
        role: 'MEMBER',
        status: 'ACTIVE',
      });

      const context = await getTenantContext();

      expect(context.tenantId).toBe('tenant-beta');
      expect(context.userId).toBe('user-multi');
      expect(context.role).toBe('MEMBER');
    });

    it('allows safe organization switching via switchTenantAction when user is an active member', async () => {
      const token = await encrypt({ userId: 'user-multi', email: 'multi@example.com' });
      mockCookiesStore.get.mockImplementation((name) => {
        if (name === 'session') return { value: token };
        return undefined;
      });

      mockTenantMemberFindUnique.mockResolvedValue({
        id: 'mem-1',
        user_id: 'user-multi',
        tenant_id: 'tenant-alpha',
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      await expect(switchTenantAction('tenant-alpha')).rejects.toThrow('NEXT_REDIRECT');

      expect(mockCookiesStore.set).toHaveBeenCalledWith(
        'active_tenant_id',
        'tenant-alpha',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
      );
      expect(mockRedirect).toHaveBeenCalledWith('/');
    });
  });

  describe('3. Forged Tenant ID & Security Boundaries', () => {
    it('rejects forged tenant cookie if user is not a member of that organization', async () => {
      const token = await encrypt({ userId: 'user-1', email: 'victim@example.com' });
      mockCookiesStore.get.mockImplementation((name) => {
        if (name === 'session') return { value: token };
        if (name === 'active_tenant_id') return { value: 'foreign-tenant-evil' };
        return undefined;
      });

      // DB returns null for the forged tenant ID
      mockTenantMemberFindUnique.mockResolvedValue(null);

      await expect(getTenantContext()).rejects.toThrow('FORBIDDEN: User is not a member of this tenant');
    });

    it('rejects forged switchTenantAction when user is not a member of target organization', async () => {
      const token = await encrypt({ userId: 'user-attacker', email: 'attacker@example.com' });
      mockCookiesStore.get.mockImplementation((name) => {
        if (name === 'session') return { value: token };
        return undefined;
      });

      mockTenantMemberFindUnique.mockResolvedValue(null);

      await expect(switchTenantAction('forged-org-target')).rejects.toThrow(
        'FORBIDDEN: User is not an active member of this organization'
      );
      expect(mockCookiesStore.set).not.toHaveBeenCalledWith('active_tenant_id', expect.any(String), expect.any(Object));
    });

    it('rejects membership when status is INACTIVE or suspended', async () => {
      const token = await encrypt({ userId: 'user-inactive', email: 'suspended@example.com' });
      mockCookiesStore.get.mockImplementation((name) => {
        if (name === 'session') return { value: token };
        if (name === 'active_tenant_id') return { value: 'tenant-locked' };
        return undefined;
      });

      mockTenantMemberFindUnique.mockResolvedValue({
        id: 'mem-locked',
        user_id: 'user-inactive',
        tenant_id: 'tenant-locked',
        role: 'MEMBER',
        status: 'SUSPENDED',
      });

      await expect(getTenantContext()).rejects.toThrow('FORBIDDEN: User is not a member of this tenant');
    });
  });

  describe('4. Zero Active Memberships & Logout Invalidation', () => {
    it('rejects access when user has zero active memberships in database', async () => {
      const token = await encrypt({ userId: 'user-stranded', email: 'stranded@example.com' });
      mockCookiesStore.get.mockImplementation((name) => {
        if (name === 'session') return { value: token };
        return undefined;
      });

      mockTenantMemberFindMany.mockResolvedValue([]);

      await expect(getTenantContext()).rejects.toThrow('FORBIDDEN: User has no active tenant membership');
    });

    it('logoutAction clears both session and active_tenant_id cookies and redirects to /login', async () => {
      await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT');

      expect(mockCookiesStore.delete).toHaveBeenCalledWith('session');
      expect(mockCookiesStore.delete).toHaveBeenCalledWith('active_tenant_id');
      expect(mockRedirect).toHaveBeenCalledWith('/login');
    });
  });

  describe('5. Login Action Initial Tenant Setup', () => {
    it('sets active_tenant_id cookie upon login if user has exactly one active membership', async () => {
      const hashedPassword = await hashPassword('password123');
      mockUserFindUnique.mockResolvedValue({
        id: 'user-single',
        email: 'single@example.com',
        password_hash: hashedPassword,
        status: 'ACTIVE',
      });

      mockTenantMemberFindMany.mockResolvedValue([
        { id: 'mem-1', user_id: 'user-single', tenant_id: 'tenant-prime', status: 'ACTIVE' },
      ]);

      const formData = new FormData();
      formData.append('email', 'single@example.com');
      formData.append('password', 'password123');

      await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT');

      expect(mockCookiesStore.set).toHaveBeenCalledWith('session', expect.any(String), expect.any(Object));
      expect(mockCookiesStore.set).toHaveBeenCalledWith('active_tenant_id', 'tenant-prime', expect.any(Object));
      expect(mockRedirect).toHaveBeenCalledWith('/');
    });

    it('redirects user to /select-tenant upon login if user has multiple active memberships', async () => {
      const hashedPassword = await hashPassword('password123');
      mockUserFindUnique.mockResolvedValue({
        id: 'user-multi',
        email: 'multi@example.com',
        password_hash: hashedPassword,
        status: 'ACTIVE',
      });

      mockTenantMemberFindMany.mockResolvedValue([
        { id: 'mem-1', user_id: 'user-multi', tenant_id: 'tenant-one', status: 'ACTIVE' },
        { id: 'mem-2', user_id: 'user-multi', tenant_id: 'tenant-two', status: 'ACTIVE' },
      ]);

      const formData = new FormData();
      formData.append('email', 'multi@example.com');
      formData.append('password', 'password123');

      await expect(loginAction(null, formData)).rejects.toThrow('NEXT_REDIRECT');

      expect(mockCookiesStore.set).toHaveBeenCalledWith('session', expect.any(String), expect.any(Object));
      expect(mockCookiesStore.set).not.toHaveBeenCalledWith('active_tenant_id', expect.any(String), expect.any(Object));
      expect(mockRedirect).toHaveBeenCalledWith('/select-tenant');
    });
  });

  describe('6. Membership Database Failure & Fail-Closed Boundaries', () => {
    it('throws SERVICE_UNAVAILABLE when memberships findMany query fails with database exception', async () => {
      const token = await encrypt({ userId: 'user-err', email: 'err@example.com' });
      mockCookiesStore.get.mockImplementation((name) => {
        if (name === 'session') return { value: token };
        return undefined;
      });

      mockTenantMemberFindMany.mockRejectedValue(new Error('FATAL: connection to database failed'));

      await expect(getTenantContext()).rejects.toThrow('SERVICE_UNAVAILABLE: Failed to query tenant memberships');
    });

    it('throws SERVICE_UNAVAILABLE when requested tenant membership findUnique query fails with database exception', async () => {
      const token = await encrypt({ userId: 'user-err', email: 'err@example.com' });
      mockCookiesStore.get.mockImplementation((name) => {
        if (name === 'session') return { value: token };
        if (name === 'active_tenant_id') return { value: 'tenant-db-fail' };
        return undefined;
      });

      mockTenantMemberFindUnique.mockRejectedValue(new Error('Connection terminated unexpectedly'));

      await expect(getTenantContext()).rejects.toThrow('SERVICE_UNAVAILABLE: Failed to verify tenant membership');
    });

    it('blocks tenant switching when target tenant is suspended', async () => {
      const token = await encrypt({ userId: 'user-switch', email: 'switch@example.com' });
      mockCookiesStore.get.mockImplementation((name) => {
        if (name === 'session') return { value: token };
        return undefined;
      });

      mockTenantMemberFindUnique.mockResolvedValue({
        id: 'mem-1',
        user_id: 'user-switch',
        tenant_id: 'tenant-suspended-target',
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      mockAuditLogFindMany.mockResolvedValue([
        {
          id: 'audit-susp-1',
          action: 'TENANT_SUSPEND',
          entity: 'Tenant',
          created_at: new Date('2026-03-01T10:00:00Z'),
        },
      ]);

      await expect(switchTenantAction('tenant-suspended-target')).rejects.toThrow(
        'FORBIDDEN: Tenant account is suspended. Please contact platform administration.'
      );
      expect(mockCookiesStore.set).not.toHaveBeenCalledWith('active_tenant_id', expect.any(String), expect.any(Object));
    });

    it('blocks tenant context resolution when single tenant is suspended', async () => {
      const token = await encrypt({ userId: 'user-single', email: 'single@example.com' });
      mockCookiesStore.get.mockImplementation((name) => {
        if (name === 'session') return { value: token };
        return undefined;
      });

      mockTenantMemberFindMany.mockResolvedValue([
        { id: 'mem-1', user_id: 'user-single', tenant_id: 'tenant-solo-suspended', role: 'OWNER', status: 'ACTIVE' },
      ]);

      mockAuditLogFindMany.mockResolvedValue([
        {
          id: 'audit-susp-2',
          action: 'TENANT_SUSPEND',
          entity: 'Tenant',
          created_at: new Date('2026-03-01T10:00:00Z'),
        },
      ]);

      await expect(getTenantContext()).rejects.toThrow(
        'FORBIDDEN: Tenant account is suspended. Please contact platform administration.'
      );
    });
  });
});
