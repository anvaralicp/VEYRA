/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inviteUser } from '../src/app/(authenticated)/admin/actions';
import { acceptInvitation } from '../src/app/invite/actions';
import { getTenantContext } from '../src/lib/tenant/context';
import crypto from 'crypto';

vi.mock('../src/lib/tenant/context', () => ({
  getTenantContext: vi.fn(),
}));

const { mockInvitationModel, mockTenantMemberModel, mockUserModel, mockAuditLogModel, mockTransaction } = vi.hoisted(() => ({
  mockInvitationModel: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  mockTenantMemberModel: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  mockUserModel: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  mockAuditLogModel: {
    create: vi.fn(),
  },
  mockTransaction: vi.fn((cb) => cb({
    Invitation: mockInvitationModel,
    User: mockUserModel,
    TenantMember: mockTenantMemberModel,
  })),
}));

vi.mock('../src/prisma/db', () => ({
  db: {
    User: mockUserModel,
    user: mockUserModel,
    TenantMember: mockTenantMemberModel,
    tenantMember: mockTenantMemberModel,
    Invitation: mockInvitationModel,
    invitation: mockInvitationModel,
    transaction: mockTransaction,
    $transaction: mockTransaction,
  },
}));

vi.mock('../src/lib/db/tenant-db', () => ({
  getTenantDb: vi.fn().mockResolvedValue({
    Invitation: mockInvitationModel,
    AuditLog: mockAuditLogModel,
  }),
}));

describe('Invitation Security Patch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('TEST: valid invitation', async () => {
    (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'admin-1', role: 'ADMIN' });
    mockUserModel.findUnique.mockResolvedValue(null);
    mockInvitationModel.create.mockResolvedValue({ id: 'inv-1' });

    // Mock findUnique to return OWNER for admin-1 and null for the new user
    mockTenantMemberModel.findUnique.mockImplementation((args: any) => {
      if (args.where.user_id_tenant_id.user_id === 'admin-1') {
        return Promise.resolve({
          status: 'ACTIVE',
          roles: [{ role: { code: 'OWNER', status: 'ACTIVE', permissions: [] } }]
        });
      }
      return Promise.resolve(null);
    });

    const result = await inviteUser({ email: 'test@example.com' });
    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();

    // Hash the returned token to verify what is saved in the mock
    const hash = crypto.createHash('sha256').update(result.token).digest('hex');
    expect(mockInvitationModel.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'test@example.com',
        token_hash: hash,
        invited_by: 'admin-1'
      })
    }));
  });

  it('TEST: expired invitation', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    mockInvitationModel.findUnique.mockResolvedValue({
      id: 'inv-1',
      status: 'PENDING',
      expires_at: pastDate,
      token_hash: 'hash'
    });

    await expect(acceptInvitation('inv-1', 'token', 'pw', 'name')).rejects.toThrow('Invitation has expired.');
    expect(mockInvitationModel.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'EXPIRED' } }));
  });

  it('TEST: reused invitation', async () => {
    mockInvitationModel.findUnique.mockResolvedValue({
      id: 'inv-1',
      status: 'ACCEPTED',
    });

    await expect(acceptInvitation('inv-1', 'token', 'pw', 'name')).rejects.toThrow('Invitation is already used or cancelled.');
  });

  it('TEST: invalid token', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);

    mockInvitationModel.findUnique.mockResolvedValue({
      id: 'inv-1',
      status: 'PENDING',
      expires_at: futureDate,
      token_hash: 'validhash'
    });

    await expect(acceptInvitation('inv-1', 'invalidtoken', 'pw', 'name')).rejects.toThrow('Invalid token.');
  });

  it('TEST: invited user can login after setting password', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);

    const validToken = 'validtoken';
    const validHash = crypto.createHash('sha256').update(validToken).digest('hex');

    mockInvitationModel.findUnique.mockResolvedValue({
      id: 'inv-1',
      status: 'PENDING',
      expires_at: futureDate,
      token_hash: validHash,
      email: 'new@example.com',
      tenant_id: 'tenant-A'
    });

    // Assume user doesn't exist yet in transaction
    mockUserModel.findUnique.mockResolvedValue(null);
    mockUserModel.create.mockResolvedValue({ id: 'user-new' });

    const result = await acceptInvitation('inv-1', validToken, 'MySecurePassword', 'Alice');

    expect(result.success).toBe(true);
    // User is created with active status
    expect(mockUserModel.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'ACTIVE' })
    }));
    // Membership is created
    expect(mockTenantMemberModel.create).toHaveBeenCalled();
  });

  it('TEST: existing user can be added to another tenant', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);

    const validToken = 'validtoken';
    const validHash = crypto.createHash('sha256').update(validToken).digest('hex');

    mockInvitationModel.findUnique.mockResolvedValue({
      id: 'inv-1',
      status: 'PENDING',
      expires_at: futureDate,
      token_hash: validHash,
      email: 'existing@example.com',
      tenant_id: 'tenant-B'
    });

    // Assume user ALREADY exists in transaction
    mockUserModel.findUnique.mockResolvedValue({ id: 'user-ext' });

    // Ensure password is not provided
    const result = await acceptInvitation('inv-1', validToken);

    expect(result.success).toBe(true);
    expect(mockUserModel.create).not.toHaveBeenCalled(); // No user created
    expect(mockTenantMemberModel.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ user_id: 'user-ext', tenant_id: 'tenant-B' })
    }));
  });

  it('TEST: cross-tenant invitation is impossible (duplicate member check)', async () => {
    (getTenantContext as any).mockResolvedValue({ tenantId: 'tenant-A', userId: 'admin-1', role: 'ADMIN' });

    // User already exists
    mockUserModel.findUnique.mockResolvedValue({ id: 'user-1' });

    mockTenantMemberModel.findUnique.mockImplementation((args: any) => {
      // Permission check for admin
      if (args.where.user_id_tenant_id.user_id === 'admin-1') {
        return Promise.resolve({
          status: 'ACTIVE',
          roles: [{ role: { code: 'OWNER', status: 'ACTIVE', permissions: [] } }]
        });
      }
      // Membership check for user-1
      if (args.where.user_id_tenant_id.user_id === 'user-1') {
        return Promise.resolve({ id: 'membership-1' });
      }
      return Promise.resolve(null);
    });

    await expect(inviteUser({ email: 'exist@example.com' })).rejects.toThrow('User is already a member of this tenant.');
  });
});
