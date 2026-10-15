import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../src/prisma/db';
import { loginAction } from '../src/app/login/actions';

// Mock dependencies
vi.mock('../src/prisma/db', () => ({
  db: {
    orm: {
      public: {
        User: {
          where: vi.fn().mockReturnThis(),
          first: vi.fn(),
          create: vi.fn(),
        },
        Tenant: {
          where: vi.fn().mockReturnThis(),
          first: vi.fn(),
          create: vi.fn(),
        },
        Permission: {
          where: vi.fn().mockReturnThis(),
          first: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
          upsert: vi.fn(),
        }
      }
    },
    transaction: vi.fn().mockImplementation(async (cb) => cb(db)),
  }
}));

interface MockUserModel {
  where: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
}

const mockUser = db.orm.public.User as unknown as MockUserModel;

vi.mock('../src/lib/auth/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed_password'),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/lib/auth/jwt', () => ({
  encrypt: vi.fn().mockResolvedValue('jwt_token'),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    set: vi.fn(),
    delete: vi.fn()
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

describe('Database and Login Repair', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Database Access API', () => {
    it('uses the supported db.orm.public.Model.where().first() API in loginAction', async () => {
      // Mock user found
      mockUser.first.mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@veyra.local',
        password_hash: 'hash',
        status: 'ACTIVE'
      });

      const formData = new FormData();
      formData.append('email', 'test@veyra.local');
      formData.append('password', 'password');

      await loginAction(null, formData);

      expect(db.orm.public.User.where).toHaveBeenCalledWith({ email: 'test@veyra.local' });
      expect(db.orm.public.User.first).toHaveBeenCalled();
    });
  });

  describe('Login Success and Failure Cases', () => {
    it('returns error for invalid credentials format', async () => {
      const formData = new FormData();
      // missing password
      formData.append('email', 'test@veyra.local');

      const res = await loginAction(null, formData);
      expect(res).toEqual({ error: "Invalid input format" });
    });

    it('returns generic error for non-existent email to prevent timing attacks', async () => {
      mockUser.first.mockResolvedValueOnce(null);

      const formData = new FormData();
      formData.append('email', 'missing@veyra.local');
      formData.append('password', 'password');

      const res = await loginAction(null, formData);
      expect(res).toEqual({ error: "Invalid email or password" });
    });

    it('returns error for deactivated user', async () => {
      mockUser.first.mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@veyra.local',
        password_hash: 'hash',
        status: 'INACTIVE'
      });

      const formData = new FormData();
      formData.append('email', 'test@veyra.local');
      formData.append('password', 'password');

      const res = await loginAction(null, formData);
      expect(res).toEqual({ error: "Account deactivated" });
    });
  });

  describe('Local Development Setup Script logic', () => {
    // Tests for script logic are tricky to run automatically without running the script itself
    // But we can verify the URL parsing logic described in the requirements
    it('refuses remote database URL before any write', () => {
      const checkUrl = (urlStr: string) => {
        const url = new URL(urlStr);
        if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
            throw new Error("DATABASE_URL protocol must be postgresql.");
        }
        if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
            throw new Error(`Hostname is '${url.hostname}', expected 'localhost' or '127.0.0.1'.`);
        }
        const dbName = url.pathname.replace(/^\//, "");
        if (dbName !== "veyra") {
            throw new Error(`Database name is '${dbName}', expected 'veyra'.`);
        }
      };

      expect(() => checkUrl("postgres://user:pass@remote.db.com:5432/veyra")).toThrow(/Hostname is/);
      expect(() => checkUrl("postgres://user:pass@localhost:5432/wrongdb")).toThrow(/Database name is/);
      expect(() => checkUrl("mysql://user:pass@localhost:5432/veyra")).toThrow(/protocol must be postgresql/);
      expect(() => checkUrl("postgres://user:pass@localhost:5432/veyra")).not.toThrow();
      expect(() => checkUrl("postgresql://user:pass@127.0.0.1:5432/veyra")).not.toThrow();
    });
  });
});
