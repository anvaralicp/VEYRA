/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockTenantFindUnique,
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

vi.mock('../src/lib/db/legacy-adapter', () => ({
  getModel: (client: any, modelName: string) => {
    if (client && client[modelName]) return client[modelName];
    if (client?.orm?.public && client.orm.public[modelName]) return client.orm.public[modelName];
    return mockTx[modelName as keyof typeof mockTx] || null;
  },
  runTransaction: async (client: any, fn: any) => fn(mockTx),
}));

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

import { getTenantRestrictions, isTenantSuspended, suspendTenant, reactivateTenant } from '../src/lib/platform/tenant-service';
import { bootstrapTenant } from '../src/lib/tenant/bootstrap';
import { updateOrganization } from '../src/app/(authenticated)/admin/actions';

describe('Production Schema Compatibility & Missing Column Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
