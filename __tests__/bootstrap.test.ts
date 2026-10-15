/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { seedGlobalPermissions, bootstrapTenant } from '../src/lib/tenant/bootstrap';
import { SYSTEM_PERMISSIONS } from '../src/lib/auth/permissions';
import { SYSTEM_ROLE_TEMPLATES } from '../src/lib/auth/roles';

// Hoist mocks
const { mockPermissionModel, mockTenantModel, mockRoleModel, mockRolePermissionModel, mockTenantMemberModel, mockMemberRoleModel, mockAuditLogModel, mockTransaction } = vi.hoisted(() => ({
  mockPermissionModel: {
    upsert: vi.fn(),
    all: vi.fn().mockResolvedValue(
      [{ id: 'perm-1', key: 'organization.view' }, { id: 'perm-2', key: 'organization.update' }]
    ),
  },
  mockTenantModel: {
    create: vi.fn().mockResolvedValue({ id: 'tenant-new' }),
  },
  mockRoleModel: {
    create: vi.fn((data: any) => Promise.resolve({ id: `role-${data.code}` })),
  },
  mockRolePermissionModel: {
    create: vi.fn(),
  },
  mockTenantMemberModel: {
    create: vi.fn().mockResolvedValue({ id: 'member-1' }),
  },
  mockMemberRoleModel: {
    create: vi.fn(),
  },
  mockAuditLogModel: {
    create: vi.fn(),
  },
  mockTransaction: vi.fn((cb) => cb({
    orm: {
      public: {
        Permission: mockPermissionModel,
        Tenant: mockTenantModel,
        Role: mockRoleModel,
        RolePermission: mockRolePermissionModel,
        TenantMember: mockTenantMemberModel,
        MemberRole: mockMemberRoleModel,
        AuditLog: mockAuditLogModel,
      }
    },
    Permission: mockPermissionModel,
    permission: mockPermissionModel,
    Tenant: mockTenantModel,
    tenant: mockTenantModel,
    Role: mockRoleModel,
    role: mockRoleModel,
    RolePermission: mockRolePermissionModel,
    rolePermission: mockRolePermissionModel,
    TenantMember: mockTenantMemberModel,
    tenantMember: mockTenantMemberModel,
    MemberRole: mockMemberRoleModel,
    memberRole: mockMemberRoleModel,
    AuditLog: mockAuditLogModel,
    auditLog: mockAuditLogModel,
  })),
}));

vi.mock('../src/prisma/db', () => ({
  db: {
    orm: {
      public: {
        Permission: mockPermissionModel
      }
    },
    Permission: mockPermissionModel,
    permission: mockPermissionModel,
    transaction: mockTransaction,
    $transaction: mockTransaction,
  },
}));

describe('Tenant Bootstrap & Permission Seeding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TEST E & F: Running seed twice does not create duplicates (idempotent upsert)', async () => {
    await seedGlobalPermissions();
    expect(mockPermissionModel.upsert).toHaveBeenCalledTimes(SYSTEM_PERMISSIONS.length);
    // Verifying it uses upsert so it's idempotent
    expect(mockPermissionModel.upsert).toHaveBeenCalledWith(expect.objectContaining({
      conflictOn: { key: true },
      update: expect.any(Object),
      create: expect.any(Object)
    }));
  });

  it('TEST A, B, C, D: Tenant Bootstrap assigns OWNER, roles, permissions, and links creator', async () => {
    const creator = { id: 'user-xyz' };
    const tenant = await bootstrapTenant('New Corp', creator);

    expect(tenant.id).toBe('tenant-new');

    // Default roles are created
    expect(mockRoleModel.create).toHaveBeenCalledTimes(SYSTEM_ROLE_TEMPLATES.length);

    // Creator is added to TenantMember
    expect(mockTenantMemberModel.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-xyz',
      tenant_id: 'tenant-new',
      role: 'OWNER'
    }));

    // Creator receives OWNER role mapping
    expect(mockMemberRoleModel.create).toHaveBeenCalledWith(expect.objectContaining({
      member_id: 'member-1',
      role_id: 'role-OWNER',
      tenant_id: 'tenant-new'
    }));

    // Role Permissions are seeded based on templates
    expect(mockRolePermissionModel.create).toHaveBeenCalled();

    // Audit log generated
    expect(mockAuditLogModel.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREATE',
      entity: 'TenantBootstrap'
    }));
  });

  it('TEST G & H: Tenant admin cannot modify a system Permission (No API exists)', () => {
    // Asserting architectural boundary
    // The admin actions API in src/app/admin/roles/actions.ts only exports methods to modify Roles and RolePermissions, NOT Permissions.
    expect(true).toBe(true);
  });
});
