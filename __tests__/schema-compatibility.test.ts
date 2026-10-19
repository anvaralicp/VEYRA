/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockTenantFindUnique,
  mockTenantFindMany,
  mockTenantUpdate,
  mockTenantCreate,
  mockAuditLogFindMany,
  mockAuditLogCreate,
  mockAuditLogCount,
  mockUserFindUnique,
  mockPermissionFindMany,
  mockPermissionUpsert,
  mockRoleFindMany,
  mockRoleCreate,
  mockRolePermissionCreate,
  mockTenantMemberFindUnique,
  mockTenantMemberFindMany,
  mockTenantMemberCreate,
  mockMemberRoleCreate,
  mockCookiesStore,
  mockTx,
} = vi.hoisted(() => {
  const mTenantFindUnique = vi.fn();
  const mTenantFindMany = vi.fn();
  const mTenantUpdate = vi.fn();
  const mTenantCreate = vi.fn();
  const mAuditLogFindMany = vi.fn();
  const mAuditLogCreate = vi.fn();
  const mAuditLogCount = vi.fn();
  const mUserFindUnique = vi.fn();
  const mPermissionFindMany = vi.fn();
  const mPermissionUpsert = vi.fn();
  const mRoleFindMany = vi.fn();
  const mRoleCreate = vi.fn();
  const mRolePermissionCreate = vi.fn();
  const mTenantMemberFindUnique = vi.fn();
  const mTenantMemberFindMany = vi.fn();
  const mTenantMemberCreate = vi.fn();
  const mMemberRoleCreate = vi.fn();
  const mCookiesStore = {
    get: vi.fn((key: string) => (key === 'session' ? { value: 'valid-token' } : null)),
    set: vi.fn(),
    delete: vi.fn(),
  };

  const tx = {
    Tenant: {
      findUnique: mTenantFindUnique,
      findMany: mTenantFindMany,
      update: mTenantUpdate,
      create: mTenantCreate,
    },
    AuditLog: {
      findMany: mAuditLogFindMany,
      create: mAuditLogCreate,
      count: mAuditLogCount,
    },
    User: {
      findUnique: mUserFindUnique,
      create: vi.fn(async () => ({ id: 'usr-1', email: 'test@example.com' })),
    },
    Permission: {
      findMany: mPermissionFindMany,
      upsert: mPermissionUpsert,
    },
    Role: {
      findMany: mRoleFindMany,
      create: mRoleCreate,
    },
    RolePermission: {
      create: mRolePermissionCreate,
    },
    TenantMember: {
      findUnique: mTenantMemberFindUnique,
      findMany: mTenantMemberFindMany,
      create: mTenantMemberCreate,
    },
    MemberRole: {
      create: mMemberRoleCreate,
    },
  };

  return {
    mockTenantFindUnique: mTenantFindUnique,
    mockTenantFindMany: mTenantFindMany,
    mockTenantUpdate: mTenantUpdate,
    mockTenantCreate: mTenantCreate,
    mockAuditLogFindMany: mAuditLogFindMany,
    mockAuditLogCreate: mAuditLogCreate,
    mockAuditLogCount: mAuditLogCount,
    mockUserFindUnique: mUserFindUnique,
    mockPermissionFindMany: mPermissionFindMany,
    mockPermissionUpsert: mPermissionUpsert,
    mockRoleFindMany: mRoleFindMany,
    mockRoleCreate: mRoleCreate,
    mockRolePermissionCreate: mRolePermissionCreate,
    mockTenantMemberFindUnique: mTenantMemberFindUnique,
    mockTenantMemberFindMany: mTenantMemberFindMany,
    mockTenantMemberCreate: mTenantMemberCreate,
    mockMemberRoleCreate: mMemberRoleCreate,
    mockCookiesStore: mCookiesStore,
    mockTx: tx,
  };
});

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookiesStore),
  headers: vi.fn(async () => ({
    get: vi.fn((key: string) => (key === 'x-tenant-id' ? 'tenant-123' : null)),
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('../src/lib/auth/session', () => ({
  getSession: vi.fn(async () => ({ userId: 'usr-1', email: 'admin@example.com' })),
}));

vi.mock('../src/prisma/db', () => ({
  db: {
    Tenant: {
      findUnique: mockTenantFindUnique,
      findMany: mockTenantFindMany,
      update: mockTenantUpdate,
      create: mockTenantCreate,
    },
    AuditLog: {
      findMany: mockAuditLogFindMany,
      create: mockAuditLogCreate,
      count: mockAuditLogCount,
    },
    User: {
      findUnique: mockUserFindUnique,
      count: vi.fn(async () => 1),
    },
    TenantMember: {
      findUnique: mockTenantMemberFindUnique,
      findMany: mockTenantMemberFindMany,
    },
  },
}));

vi.mock('../src/lib/db/legacy-adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/db/legacy-adapter')>();
  return {
    ...actual,
    getModel: (client: any, modelName: string) => {
      if (client && client[modelName]) return client[modelName];
      if (client?.orm?.public && client.orm.public[modelName]) return client.orm.public[modelName];
      return mockTx[modelName as keyof typeof mockTx] || null;
    },
    runTransaction: async (client: any, fn: any) => fn(mockTx),
  };
});

vi.mock('../src/lib/audit/logger', () => ({
  logAuditTx: vi.fn(async () => {}),
  createAuditLog: vi.fn(async () => {}),
}));

vi.mock('../src/lib/auth/boundary', () => ({
  requireTenantContext: vi.fn(async () => ({ tenantId: 'tenant-123', userId: 'usr-1', role: 'ADMIN' })),
  requirePermission: vi.fn(async () => true),
  requireAuthenticatedUser: vi.fn(async () => ({ userId: 'usr-1', email: 'admin@example.com' })),
  getAllUserPermissions: vi.fn(async () => ({ isOwner: true, permissions: ['*'] })),
}));

vi.mock('../src/lib/auth/platform', () => ({
  requirePlatformPermission: vi.fn(async () => ({ userId: 'usr-platform', email: 'platform@veyra.internal' })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import {
  getTenantRestrictions,
  isTenantSuspended,
  getTenantLifecycleStatus,
  suspendTenant,
  reactivateTenant,
  getPlatformOverviewMetrics,
  resetSchemaCompatibilityCache,
  isMissingColumnError,
} from '../src/lib/platform/tenant-service';
import { adaptPrisma7 } from '../src/lib/db/legacy-adapter';
import { bootstrapTenant } from '../src/lib/tenant/bootstrap';
import { updateOrganization } from '../src/app/(authenticated)/admin/actions';

describe('Production Schema Compatibility & Missing Column Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSchemaCompatibilityCache();
    mockTenantMemberFindUnique.mockResolvedValue({
      user_id: 'usr-1',
      tenant_id: 'tenant-123',
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    mockTenantMemberFindMany.mockResolvedValue([
      {
        user_id: 'usr-1',
        tenant_id: 'tenant-123',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    ]);
  });

  describe('Tenant Restrictions & Lifecycle Fallback (getTenantRestrictions & isTenantSuspended)', () => {
    it('gracefully falls back to AuditLog when Increment 2 restriction columns do not exist in DB (SQLSTATE 42703)', async () => {
      mockTenantFindUnique.mockRejectedValueOnce(
        new Error('Error [SqlQueryError]: column Tenant.is_administrative_restricted does not exist')
      );

      mockAuditLogFindMany.mockResolvedValueOnce([
        {
          id: 'log-1',
          action: 'TENANT_RESTRICT',
          details: JSON.stringify({
            flags: {
              is_security_restricted: true,
              is_policy_restricted: false,
              is_billing_restricted: true,
              is_administrative_restricted: false,
            },
          }),
        },
      ]);

      const restrictions = await getTenantRestrictions('tenant-123');
      expect(restrictions.is_security_restricted).toBe(true);
      expect(restrictions.is_billing_restricted).toBe(true);
      expect(restrictions.is_policy_restricted).toBe(false);
      expect(restrictions.is_administrative_restricted).toBe(false);
    });

    it('fails closed (throws SERVICE_UNAVAILABLE) if AuditLog is unavailable during unmigrated restriction check', async () => {
      mockTenantFindUnique.mockRejectedValueOnce(
        new Error('column Tenant.is_administrative_restricted does not exist')
      );
      mockAuditLogFindMany.mockRejectedValueOnce(new Error('Connection lost to audit store'));

      await expect(getTenantRestrictions('tenant-123')).rejects.toThrow('SERVICE_UNAVAILABLE');
    });

    it('detects tenant suspension via AuditLog fallback when lifecycle_status column is missing', async () => {
      mockTenantFindUnique.mockRejectedValueOnce(
        new Error('column Tenant.lifecycle_status does not exist')
      );
      mockAuditLogFindMany.mockResolvedValueOnce([
        {
          id: 'log-suspend',
          action: 'TENANT_SUSPEND',
          details: { reason: 'Security investigation' },
          created_at: new Date(),
        },
      ]);

      const suspended = await isTenantSuspended('tenant-123');
      expect(suspended).toBe(true);
    });
  });

  describe('Organization Update Action (updateOrganization)', () => {
    it('successfully updates organization in legacy schema mode without version column', async () => {
      // Setup mock implementation: when selecting version or Increment 2 columns, throw SQL missing column error.
      // When selecting legacy columns (id, name), return legacy record.
      mockTenantFindUnique.mockImplementation(async (args: any) => {
        if (args?.select?.version || args?.select?.lifecycle_status || args?.select?.is_administrative_restricted) {
          throw new Error('Error [SqlQueryError]: column Tenant.version does not exist');
        }
        return { id: 'tenant-123', name: 'Original Name' };
      });

      mockAuditLogFindMany.mockResolvedValue([]);
      mockTenantUpdate.mockResolvedValue({ id: 'tenant-123' });

      const formData = new FormData();
      formData.set('name', 'Updated Org Name');
      formData.set('timezone', 'Asia/Kolkata');

      await updateOrganization(formData);

      // Verify update called without version field in legacy mode
      expect(mockTenantUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-123' },
          data: expect.not.objectContaining({ version: expect.anything() }),
        })
      );
      expect(mockTenantUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Updated Org Name', timezone: 'Asia/Kolkata' }),
        })
      );
    });

    it('fails closed when tenant is under administrative restriction', async () => {
      mockTenantFindUnique.mockImplementation(async (args: any) => {
        if (args?.select?.lifecycle_status) {
          return { lifecycle_status: 'ACTIVE' };
        }
        if (args?.select?.is_administrative_restricted) {
          return {
            id: 'tenant-123',
            is_administrative_restricted: true,
            is_security_restricted: false,
            is_policy_restricted: false,
            is_billing_restricted: false,
          };
        }
        return { id: 'tenant-123', name: 'Org' };
      });

      const formData = new FormData();
      formData.set('name', 'Hacked Org Name');

      await expect(updateOrganization(formData)).rejects.toThrow('administrative restriction');
    });

    it('fails closed when tenant is suspended', async () => {
      mockTenantFindUnique.mockImplementation(async (args: any) => {
        if (args?.select?.lifecycle_status) {
          return { lifecycle_status: 'SUSPENDED' };
        }
        return { id: 'tenant-123', name: 'Org' };
      });

      const formData = new FormData();
      formData.set('name', 'Suspended Org Name');

      await expect(updateOrganization(formData)).rejects.toThrow('suspended');
    });
  });

  describe('Tenant Suspension & Reactivation in Legacy Schema Mode', () => {
    it('suspends tenant in legacy schema mode via AuditLog without writing unmigrated columns', async () => {
      mockTenantFindUnique.mockImplementation(async (args: any) => {
        if (args?.select?.version || args?.select?.lifecycle_status) {
          throw new Error('column Tenant.version does not exist');
        }
        return { id: 'tenant-123', name: 'Legacy Tenant' };
      });

      // AuditLog check indicates tenant is currently active
      mockAuditLogFindMany.mockResolvedValue([]);
      mockTenantUpdate.mockResolvedValue({ id: 'tenant-123' });

      const res = await suspendTenant('tenant-123', 'Regulatory non-compliance');
      expect(res.success).toBe(true);

      // Verify Tenant.update did NOT write lifecycle_status or version
      expect(mockTenantUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-123' },
          data: expect.not.objectContaining({ lifecycle_status: 'SUSPENDED' }),
        })
      );
    });

    it('reactivates tenant in legacy schema mode via AuditLog without writing unmigrated columns', async () => {
      mockTenantFindUnique.mockImplementation(async (args: any) => {
        if (args?.select?.version || args?.select?.lifecycle_status) {
          throw new Error('column Tenant.version does not exist');
        }
        return { id: 'tenant-123', name: 'Legacy Tenant' };
      });

      // AuditLog check indicates tenant is currently suspended
      mockAuditLogFindMany.mockResolvedValue([
        { action: 'TENANT_SUSPEND', created_at: new Date() },
      ]);

      mockTenantUpdate.mockResolvedValue({ id: 'tenant-123' });

      const res = await reactivateTenant('tenant-123');
      expect(res.success).toBe(true);

      expect(mockTenantUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tenant-123' },
          data: expect.not.objectContaining({ lifecycle_status: 'ACTIVE' }),
        })
      );
    });
  });

  describe('Tenant Bootstrap in Legacy Schema Mode', () => {
    it('creates tenant with legacy fields if Increment 2 defaults throw column missing error', async () => {
      mockTenantCreate
        // First attempt with Increment 2 fields throws SQL error
        .mockRejectedValueOnce(new Error('column Tenant.version does not exist'))
        // Fallback create with legacy fields succeeds
        .mockResolvedValueOnce({ id: 'new-tenant-1', name: 'New Legacy Org' });

      mockPermissionUpsert.mockResolvedValue({ id: 'p1' });
      mockPermissionFindMany.mockResolvedValueOnce([{ id: 'p1', key: 'crm.customers.view' }]);
      mockRoleCreate.mockResolvedValue({ id: 'r1' });
      mockRoleFindMany.mockResolvedValueOnce([]);
      mockTenantMemberCreate.mockResolvedValue({ id: 'tm1' });
      mockMemberRoleCreate.mockResolvedValue({ id: 'mr1' });

      const result = await bootstrapTenant('New Legacy Org', { id: 'usr-creator' });

      expect(result.id).toBe('new-tenant-1');
      expect(mockTenantCreate).toHaveBeenCalledTimes(2);
      expect(mockTenantCreate).toHaveBeenLastCalledWith({
        data: { name: 'New Legacy Org' },
      });
    });
  });

  describe('Platform Overview Metrics in Legacy Schema Mode (getPlatformOverviewMetrics)', () => {
    beforeEach(() => {
      resetSchemaCompatibilityCache();
    });

    it('calculates metrics safely in legacy schema mode when lifecycle columns are absent', async () => {
      // Tenant.findMany returns 2 tenants
      mockTenantFindMany.mockResolvedValueOnce([
        { id: 't-1', created_at: new Date('2026-01-01T00:00:00Z') },
        { id: 't-2', created_at: new Date('2026-01-02T00:00:00Z') },
      ]);

      // Tenant.findUnique throws SQLSTATE 42703 for missing lifecycle_status column
      mockTenantFindUnique.mockRejectedValue(
        new Error('SqlQueryError: column Tenant.lifecycle_status does not exist (SQLSTATE 42703)')
      );

      // AuditLog calls:
      // t-1 lifecycle -> ACTIVE
      // t-1 subscription -> default trial
      // t-2 lifecycle -> SUSPENDED
      // t-2 subscription -> default trial
      // recentEvents -> []
      mockAuditLogFindMany
        .mockResolvedValueOnce([]) // t-1 lifecycle (no suspend event -> ACTIVE)
        .mockResolvedValueOnce([]) // t-1 subscription
        .mockResolvedValueOnce([
          { id: 'log-s', action: 'TENANT_SUSPEND', entity: 'Tenant', details: { reason: 'Policy breach' }, created_at: new Date() }
        ]) // t-2 lifecycle -> SUSPENDED
        .mockResolvedValueOnce([]) // t-2 subscription
        .mockResolvedValueOnce([]); // recentEvents

      const metrics = await getPlatformOverviewMetrics();

      expect(metrics.totalTenants).toBe(2);
      expect(metrics.activeTenants).toBe(1);
      expect(metrics.suspendedTenants).toBe(1);
      expect(metrics.pendingTenants).toBe(0);
      expect(metrics.unverifiedTenants).toBe(0);
      expect(metrics.planDistribution.trial).toBe(2);
    });

    it('avoids repeatedly issuing queries for known-absent columns across multiple tenants (schema cache)', async () => {
      mockTenantFindMany.mockResolvedValueOnce([
        { id: 't-1', created_at: new Date() },
        { id: 't-2', created_at: new Date() },
        { id: 't-3', created_at: new Date() },
      ]);

      mockTenantFindUnique.mockRejectedValue(
        new Error('column Tenant.lifecycle_status does not exist')
      );

      // 3 lifecycle queries + 3 subscription queries + 1 recentEvents query
      mockAuditLogFindMany.mockResolvedValue([]);

      await getPlatformOverviewMetrics();

      // Tenant.findUnique should only be probed ONCE for lifecycle status across all 3 tenants
      // because hasTenantLifecycleColumns=false is safely cached after the first 42703 error
      expect(mockTenantFindUnique).toHaveBeenCalledTimes(1);
    });

    it('classifies tenant as unverified instead of ACTIVE when lifecycle status cannot be established (audit failure)', async () => {
      mockTenantFindMany.mockResolvedValueOnce([
        { id: 't-unverified', created_at: new Date() },
      ]);

      mockTenantFindUnique.mockRejectedValue(
        new Error('column Tenant.lifecycle_status does not exist')
      );

      // t-unverified lifecycle check fails with SERVICE_UNAVAILABLE from audit store
      mockAuditLogFindMany
        .mockRejectedValueOnce(new Error('Audit store read failure')) // lifecycle fallback fails
        .mockResolvedValueOnce([]) // subscription metadata succeeds
        .mockResolvedValueOnce([]); // recentEvents succeeds

      const metrics = await getPlatformOverviewMetrics();

      expect(metrics.totalTenants).toBe(1);
      expect(metrics.activeTenants).toBe(0); // STRICT INTEGRITY: Never classified as ACTIVE
      expect(metrics.suspendedTenants).toBe(0);
      expect(metrics.unverifiedTenants).toBe(1); // Explicitly reported as unverified
    });

    it('propagates fatal database connection errors without silently returning empty results (fail-closed)', async () => {
      mockTenantFindMany.mockRejectedValueOnce(new Error('Database connection refused [ECONNREFUSED]'));

      await expect(getPlatformOverviewMetrics()).rejects.toThrow('Database connection refused');
    });

    it('correctly reads lifecycle status from Increment 2 column when migrated schema is present', async () => {
      mockTenantFindMany.mockResolvedValueOnce([
        { id: 't-migrated-1', created_at: new Date() },
        { id: 't-migrated-2', created_at: new Date() },
      ]);

      mockTenantFindUnique
        .mockResolvedValueOnce({ lifecycle_status: 'ACTIVE' })
        .mockResolvedValueOnce({ lifecycle_status: 'SUSPENDED' });

      mockAuditLogFindMany.mockResolvedValue([]);

      const metrics = await getPlatformOverviewMetrics();

      expect(metrics.totalTenants).toBe(2);
      expect(metrics.activeTenants).toBe(1);
      expect(metrics.suspendedTenants).toBe(1);
      expect(metrics.unverifiedTenants).toBe(0);
    });

    it('differentiates missing column errors from missing table (P2021/42P01) and arbitrary database exceptions via isMissingColumnError', () => {
      // Postgres 42703 / Prisma P2022 / missing column text => true
      expect(isMissingColumnError(new Error('column Tenant.is_administrative_restricted does not exist'))).toBe(true);
      expect(isMissingColumnError(new Error('SqlQueryError: column Tenant.lifecycle_status does not exist (42703)'))).toBe(true);
      expect(isMissingColumnError({ code: '42703', message: 'undefined column' })).toBe(true);
      expect(isMissingColumnError({ code: 'P2022', message: 'Column does not exist in current database' })).toBe(true);
      expect(isMissingColumnError(new Error('no such column: is_billing_restricted'))).toBe(true);

      // Missing TABLE (P2021 / 42P01) must NOT be treated as missing column
      expect(isMissingColumnError({ code: 'P2021', message: 'The table public.Tenant does not exist in the current database.' })).toBe(false);
      expect(isMissingColumnError({ code: '42P01', message: 'relation "Tenant" does not exist' })).toBe(false);
      expect(isMissingColumnError(new Error('The table public.Tenant does not exist in the current database'))).toBe(false);

      // Connection failures, timeouts, permissions must NOT be classified as missing column
      expect(isMissingColumnError(new Error('Database connection dropped'))).toBe(false);
      expect(isMissingColumnError(new Error('ETIMEDOUT'))).toBe(false);
      expect(isMissingColumnError(new Error('ECONNREFUSED: connection refused'))).toBe(false);
      expect(isMissingColumnError({ code: '28P01', message: 'password authentication failed' })).toBe(false);
      expect(isMissingColumnError({ code: '42501', message: 'permission denied for table Tenant' })).toBe(false);
      expect(isMissingColumnError({ code: '08006', message: 'connection failure' })).toBe(false);
      expect(isMissingColumnError(null)).toBe(false);
      expect(isMissingColumnError(undefined)).toBe(false);
    });

    it('isolates schema compatibility cache across different database clients without cross-contamination', async () => {
      // Create two independent mock clients
      const clientLegacy: any = {
        Tenant: {
          findUnique: vi.fn().mockRejectedValue(new Error('column Tenant.lifecycle_status does not exist (42703)')),
        },
        AuditLog: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      const clientMigrated: any = {
        Tenant: {
          findUnique: vi.fn().mockResolvedValue({ lifecycle_status: 'ACTIVE' }),
        },
        AuditLog: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      // Client A (legacy) should trigger fallback and cache absence for client A only
      const statusA = await getTenantLifecycleStatus('tenant-a', clientLegacy);
      expect(statusA.status).toBe('ACTIVE');
      expect(clientLegacy.Tenant.findUnique).toHaveBeenCalledTimes(1);

      // Second call on client A should use cached status (no second probe on Tenant)
      await getTenantLifecycleStatus('tenant-a', clientLegacy);
      expect(clientLegacy.Tenant.findUnique).toHaveBeenCalledTimes(1);

      // Client B (migrated) should NOT inherit client A's false cache! It must probe and succeed
      const statusB = await getTenantLifecycleStatus('tenant-b', clientMigrated);
      expect(statusB.status).toBe('ACTIVE');
      expect(clientMigrated.Tenant.findUnique).toHaveBeenCalledTimes(1);

      // Client B should also cache its own positive status
      await getTenantLifecycleStatus('tenant-b', clientMigrated);
      expect(clientMigrated.Tenant.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('Legacy Adapter adaptPrisma7 Query Building & Select Pruning', () => {
    it('chains where, select, orderBy, skip, and take together on collection', async () => {
      const mockCollection: any = {
        where: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue([{ id: 't1', name: 'Acme' }]),
      };

      const adapted = adaptPrisma7(mockCollection);
      const res = await adapted.findMany({
        where: { name: 'Acme' },
        select: { id: true, name: true },
        orderBy: { created_at: 'desc' },
        skip: 10,
        take: 5,
      });

      expect(res).toEqual([{ id: 't1', name: 'Acme' }]);
      expect(mockCollection.where).toHaveBeenCalledWith({ name: 'Acme' });
      expect(mockCollection.select).toHaveBeenCalledWith('id', 'name');
      expect(mockCollection.orderBy).toHaveBeenCalled();
      expect(mockCollection.offset).toHaveBeenCalledWith(10);
      expect(mockCollection.limit).toHaveBeenCalledWith(5);
      expect(mockCollection.all).toHaveBeenCalledTimes(1);
    });

    it('rejects empty select object without silently falling back to full-row selectAllIntent', async () => {
      const mockCollection: any = {
        select: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue([]),
      };

      const adapted = adaptPrisma7(mockCollection);
      await expect(adapted.findMany({ select: {} })).rejects.toThrow('The `select` option cannot be an empty object.');
    });

    it('rejects all-false select without silently falling back to full-row query', async () => {
      const mockCollection: any = {
        select: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue([]),
      };

      const adapted = adaptPrisma7(mockCollection);
      await expect(adapted.findMany({ select: { id: false } })).rejects.toThrow(
        'The `select` option must contain at least one field or relation selection.'
      );
    });

    it('delegates relation selections in select to include', async () => {
      const mockCollection: any = {
        select: vi.fn().mockReturnThis(),
        include: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue([]),
      };

      const adapted = adaptPrisma7(mockCollection);
      await adapted.findMany({
        select: {
          id: true,
          members: { where: { status: 'ACTIVE' } },
        },
      });

      expect(mockCollection.select).toHaveBeenCalledWith('id');
      expect(mockCollection.include).toHaveBeenCalledWith('members', expect.any(Function));
    });
  });
});
