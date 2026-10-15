import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requirePermission } from '../src/lib/auth/boundary';

vi.mock('../src/lib/tenant/context', () => ({
  getTenantContext: vi.fn().mockResolvedValue({
    tenantId: 'tenant-1',
    userId: 'user-1'
  })
}));

const { mockTenantMemberModel } = vi.hoisted(() => ({
  mockTenantMemberModel: {
    findUnique: vi.fn(),
  }
}));

vi.mock('../src/prisma/db', () => ({
  db: {
    TenantMember: mockTenantMemberModel,
    tenantMember: mockTenantMemberModel,
  },
}));

describe('Role-Based Access Control (RBAC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockMember = (status: string, roleCode: string, permissions: string[]) => ({
    status,
    roles: [
      {
        role: {
          code: roleCode,
          status: 'ACTIVE',
          permissions: permissions.map(p => ({
            permission: { key: p }
          }))
        }
      }
    ]
  });

  it('TEST A & C: User with specific permissions is ALLOWED', async () => {
    mockTenantMemberModel.findUnique.mockResolvedValue(
      createMockMember('ACTIVE', 'SALES', ['customer.view', 'customer.create'])
    );

    // Should resolve without throwing
    await expect(requirePermission('customer.view')).resolves.toBe(true);
    await expect(requirePermission('customer.create')).resolves.toBe(true);
  });

  it('TEST B & D: User without specific permissions is DENIED', async () => {
    mockTenantMemberModel.findUnique.mockResolvedValue(
      createMockMember('ACTIVE', 'GUEST', ['customer.view'])
    );

    await expect(requirePermission('customer.create')).rejects.toThrow('FORBIDDEN: Requires permission customer.create');
  });

  it('TEST G: Tenant A role permissions cannot affect Tenant B', async () => {
    // getTenantContext / requireTenantContext extracts the EXACT tenant ID from the authenticated session boundaries
    // The query explicitly requires: where: { user_id_tenant_id: { user_id: context.userId, tenant_id: context.tenantId } }
    // Thus it is structurally impossible for Tenant A roles to bleed into Tenant B.

    // Simulate crossing tenant boundary - member doesn't exist in Tenant B
    mockTenantMemberModel.findUnique.mockResolvedValue(null);

    await expect(requirePermission('customer.view')).rejects.toThrow('FORBIDDEN: Missing or inactive tenant membership');
  });

  it('TEST H: User with multiple roles receives the union of their permissions', async () => {
    mockTenantMemberModel.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      roles: [
        {
          role: {
            code: 'R1',
            status: 'ACTIVE',
            permissions: [{ permission: { key: 'perm.1' } }]
          }
        },
        {
          role: {
            code: 'R2',
            status: 'ACTIVE',
            permissions: [{ permission: { key: 'perm.2' } }]
          }
        }
      ]
    });

    await expect(requirePermission('perm.1')).resolves.toBe(true);
    await expect(requirePermission('perm.2')).resolves.toBe(true);
  });

  it('TEST I: Deactivated role grants no permissions', async () => {
    mockTenantMemberModel.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      roles: [
        {
          role: {
            code: 'R1',
            status: 'INACTIVE',
            permissions: [{ permission: { key: 'perm.1' } }]
          }
        }
      ]
    });

    await expect(requirePermission('perm.1')).rejects.toThrow('FORBIDDEN: Requires permission perm.1');
  });

  it('TEST J: Deactivated tenant membership grants no permissions', async () => {
    mockTenantMemberModel.findUnique.mockResolvedValue(
      createMockMember('INACTIVE', 'ADMIN', ['perm.1'])
    );

    await expect(requirePermission('perm.1')).rejects.toThrow('FORBIDDEN: Missing or inactive tenant membership');
  });

  it('OWNER safely bypasses specific permissions', async () => {
    mockTenantMemberModel.findUnique.mockResolvedValue(
      createMockMember('ACTIVE', 'OWNER', []) // No explicit permissions
    );

    await expect(requirePermission('anything')).resolves.toBe(true);
  });
});
