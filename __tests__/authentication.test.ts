import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginAction, logoutAction } from '../src/app/login/actions';
import { getSession } from '../src/lib/auth/session';
import { requireAuthenticatedUser } from '../src/lib/auth/boundary';
import { getTenantContext } from '../src/lib/tenant/context';
import { encrypt } from '../src/lib/auth/jwt';
import { hashPassword } from '../src/lib/auth/password';

const { mockCookiesStore, mockUserFindUnique, mockTenantMemberFindUnique } = vi.hoisted(() => ({
  mockCookiesStore: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  },
  mockUserFindUnique: vi.fn(),
  mockTenantMemberFindUnique: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => mockCookiesStore),
  headers: vi.fn(() => ({
    get: vi.fn((key) => {
      if (key === 'x-tenant-id') return 'tenant-A';
      return null;
    }),
  })),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('../src/prisma/db', () => ({
  db: {
    orm: {
      public: {
        User: {
          where: vi.fn(() => ({ first: mockUserFindUnique }))
        },
        TenantMember: {
          where: vi.fn(() => ({ first: mockTenantMemberFindUnique }))
        }
      }
    },
    User: {
      findUnique: mockUserFindUnique,
    },
    TenantMember: {
      findUnique: mockTenantMemberFindUnique,
    }
  },
}));

describe('Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookiesStore.get.mockReturnValue(undefined);
  });

  it('TEST A: Valid credentials authenticate successfully.', async () => {
    const hashedPassword = await hashPassword('correctPassword');
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      password_hash: hashedPassword,
      status: 'ACTIVE'
    });

    const formData = new FormData();
    formData.append('email', 'test@example.com');
    formData.append('password', 'correctPassword');

    await loginAction(null, formData);

    expect(mockCookiesStore.set).toHaveBeenCalledWith(
      'session',
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );
  });

  it('TEST B: Invalid password is rejected.', async () => {
    const hashedPassword = await hashPassword('correctPassword');
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      password_hash: hashedPassword,
      status: 'ACTIVE'
    });

    const formData = new FormData();
    formData.append('email', 'test@example.com');
    formData.append('password', 'wrongPassword');

    const result = await loginAction(null, formData);

    expect(result).toEqual({ error: 'Invalid email or password' });
    expect(mockCookiesStore.set).not.toHaveBeenCalled();
  });

  it('TEST C: Unknown user is rejected.', async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const formData = new FormData();
    formData.append('email', 'unknown@example.com');
    formData.append('password', 'anyPassword');

    const result = await loginAction(null, formData);

    expect(result).toEqual({ error: 'Invalid email or password' });
    expect(mockCookiesStore.set).not.toHaveBeenCalled();
  });

  it('TEST H: Deactivated users cannot authenticate.', async () => {
    const hashedPassword = await hashPassword('correctPassword');
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'deactivated@example.com',
      password_hash: hashedPassword,
      status: 'INACTIVE'
    });

    const formData = new FormData();
    formData.append('email', 'deactivated@example.com');
    formData.append('password', 'correctPassword');

    const result = await loginAction(null, formData);

    expect(result).toEqual({ error: 'Account deactivated' });
    expect(mockCookiesStore.set).not.toHaveBeenCalled();
  });

  it('TEST D: Unauthenticated request is rejected by requireAuthenticatedUser().', async () => {
    // No cookie set
    await expect(requireAuthenticatedUser()).rejects.toThrow('UNAUTHORIZED: User is not authenticated');
  });

  it('TEST E: Authenticated user can resolve their user ID.', async () => {
    const token = await encrypt({ userId: 'user-1', email: 'test@example.com' });
    mockCookiesStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session?.userId).toBe('user-1');
    expect(session?.email).toBe('test@example.com');
  });

  it('TEST F: Authenticated user can resolve their valid tenant membership.', async () => {
    // Session is valid
    const token = await encrypt({ userId: 'user-1', email: 'test@example.com' });
    mockCookiesStore.get.mockReturnValue({ value: token });

    // Membership is valid
    mockTenantMemberFindUnique.mockResolvedValue({
      user_id: 'user-1',
      tenant_id: 'tenant-A',
      role: 'MEMBER'
    });

    const context = await getTenantContext();
    expect(context.tenantId).toBe('tenant-A');
    expect(context.userId).toBe('user-1');
  });

  it('TEST G: Authentication cannot bypass existing tenant isolation.', async () => {
    // Session is valid
    const token = await encrypt({ userId: 'user-1', email: 'test@example.com' });
    mockCookiesStore.get.mockReturnValue({ value: token });

    // User attempts to access tenant-B, but they are NOT a member
    // The headers mock returns 'tenant-A' but let's test the DB block directly by saying findUnique returns null
    mockTenantMemberFindUnique.mockResolvedValue(null);

    await expect(getTenantContext()).rejects.toThrow('FORBIDDEN: User is not a member of this tenant');
  });

  it('TEST H: Logout invalidates the session.', async () => {
    await logoutAction();
    expect(mockCookiesStore.delete).toHaveBeenCalledWith('session');
  });
});
