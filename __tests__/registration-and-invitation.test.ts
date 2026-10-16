/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { registerAction } from "../src/app/register/actions";
import {
  acceptInvitation,
  getInvitationDetails,
  acceptInvitationAction,
} from "../src/app/invite/actions";
import { hashPassword } from "../src/lib/auth/password";
import { db } from "../src/prisma/db";

const {
  mockCookiesStore,
  mockRedirect,
  mockUserModel,
  mockTenantModel,
  mockInvitationModel,
  mockTenantMemberModel,
  mockAuditLogModel,
  mockBootstrapTenant,
  mockGetSession,
  mockTransaction,
} = vi.hoisted(() => {
  const userModel = {
    findUnique: vi.fn(),
    create: vi.fn(),
  };
  const tenantModel = {
    findUnique: vi.fn(),
    create: vi.fn(),
  };
  const invitationModel = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  };
  const tenantMemberModel = {
    findUnique: vi.fn(),
    create: vi.fn(),
  };
  const auditLogModel = {
    create: vi.fn(),
  };

  const tx = {
    Invitation: invitationModel,
    invitation: invitationModel,
    User: userModel,
    user: userModel,
    TenantMember: tenantMemberModel,
    tenantMember: tenantMemberModel,
    AuditLog: auditLogModel,
    auditLog: auditLogModel,
  };

  return {
    mockCookiesStore: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
    mockRedirect: vi.fn(),
    mockUserModel: userModel,
    mockTenantModel: tenantModel,
    mockInvitationModel: invitationModel,
    mockTenantMemberModel: tenantMemberModel,
    mockAuditLogModel: auditLogModel,
    mockBootstrapTenant: vi.fn(),
    mockGetSession: vi.fn(),
    mockTransaction: vi.fn((cb: any) => cb(tx)),
  };
});

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookiesStore),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    mockRedirect(url);
    const err = new Error("NEXT_REDIRECT");
    (err as any).digest = `NEXT_REDIRECT;replace;${url};307;;`;
    throw err;
  }),
}));

vi.mock("../src/prisma/db", () => ({
  db: {
    User: mockUserModel,
    user: mockUserModel,
    Tenant: mockTenantModel,
    tenant: mockTenantModel,
    Invitation: mockInvitationModel,
    invitation: mockInvitationModel,
    TenantMember: mockTenantMemberModel,
    tenantMember: mockTenantMemberModel,
    AuditLog: mockAuditLogModel,
    auditLog: mockAuditLogModel,
    transaction: mockTransaction,
    $transaction: mockTransaction,
  },
}));

vi.mock("../src/lib/auth/session", () => ({
  getSession: () => mockGetSession(),
}));

vi.mock("../src/lib/tenant/bootstrap", () => ({
  bootstrapTenant: (...args: any[]) => mockBootstrapTenant(...args),
}));

describe("Milestone 2: Security Audit & Acceptance Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(null);
    mockAuditLogModel.create.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Registration Atomicity & Abuse Resistance", () => {
    it("validates required fields, short lengths, and bad email format", async () => {
      const formData = new FormData();
      formData.append("organizationName", "A");
      formData.append("name", "B");
      formData.append("email", "invalid-email");
      formData.append("password", "short");

      const res1 = await registerAction(null, formData);
      expect(res1?.error).toContain("Organization name must be at least 2 characters");

      formData.set("organizationName", "Acme Integrators");
      const res2 = await registerAction(null, formData);
      expect(res2?.error).toContain("Full name must be at least 2 characters");

      formData.set("name", "Alice Engineer");
      const res3 = await registerAction(null, formData);
      expect(res3?.error).toContain("valid email");

      formData.set("email", "alice@acme.com");
      const res4 = await registerAction(null, formData);
      expect(res4?.error).toContain("Password must be at least 8 characters");
    });

    it("rejects registration when Terms and Privacy acceptance is missing, unchecked, or invalid", async () => {
      const formData = new FormData();
      formData.append("organizationName", "Acme Integrators");
      formData.append("name", "Alice Engineer");
      formData.append("email", "alice@acme.com");
      formData.append("password", "SecurePassword123!");

      // 1. Missing agreeTerms (omitted checkbox in standard HTML form)
      const resMissing = await registerAction(null, formData);
      expect(resMissing?.error).toBe("Please accept the Terms of Service and Privacy Policy to proceed.");

      // 2. Unchecked / empty string (client hidden input when unchecked)
      formData.set("agreeTerms", "");
      const resEmpty = await registerAction(null, formData);
      expect(resEmpty?.error).toBe("Please accept the Terms of Service and Privacy Policy to proceed.");

      // 3. Explicitly false or invalid value
      formData.set("agreeTerms", "false");
      const resFalse = await registerAction(null, formData);
      expect(resFalse?.error).toBe("Please accept the Terms of Service and Privacy Policy to proceed.");

      // 4. Passes validation when agreeTerms is "on" (standard checkbox)
      mockUserModel.findUnique.mockResolvedValueOnce({ id: "user-1", email: "alice@acme.com" });
      formData.set("agreeTerms", "on");
      const resOn = await registerAction(null, formData);
      // Reaches user existence check, proving terms validation passed
      expect(resOn?.error).toBe("An account with this email already exists. Please log in to continue.");

      // 5. Passes validation when agreeTerms is "true" (review step hidden input)
      mockUserModel.findUnique.mockResolvedValueOnce({ id: "user-1", email: "alice@acme.com" });
      formData.set("agreeTerms", "true");
      const resTrue = await registerAction(null, formData);
      expect(resTrue?.error).toBe("An account with this email already exists. Please log in to continue.");
    });

    it("prevents registration when user email already exists prior to bootstrap", async () => {
      mockUserModel.findUnique.mockResolvedValueOnce({
        id: "existing-user-1",
        email: "existing@acme.com",
      });

      const formData = new FormData();
      formData.append("organizationName", "Acme Corp");
      formData.append("name", "Bob Existing");
      formData.append("email", "existing@acme.com");
      formData.append("password", "StrongP@ssw0rd");
      formData.append("agreeTerms", "true");

      const res = await registerAction(null, formData);
      expect(res?.error).toContain("An account with this email already exists");
      expect(mockBootstrapTenant).not.toHaveBeenCalled();
    });

    it("fails closed when user lookup throws without leaking internal error or calling bootstrap", async () => {
      mockUserModel.findUnique.mockRejectedValueOnce(new Error("FATAL: connection timeout at 0xdeadbeef"));

      const formData = new FormData();
      formData.append("organizationName", "Acme Corp");
      formData.append("name", "Test User");
      formData.append("email", "lookup-error@acme.com");
      formData.append("password", "StrongP@ssw0rd");
      formData.append("agreeTerms", "on");

      const res = await registerAction(null, formData);
      expect(res?.error).toBe("Unable to verify account availability. Please try again shortly.");
      expect(res?.error).not.toContain("0xdeadbeef");
      expect(res?.error).not.toContain("timeout");
      expect(mockBootstrapTenant).not.toHaveBeenCalled();
      expect(mockCookiesStore.set).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("fails safely when User model is unavailable without calling bootstrap", async () => {
      const originalUser = (db as any).User;
      const originalUserLower = (db as any).user;
      (db as any).User = undefined;
      (db as any).user = undefined;

      try {
        const formData = new FormData();
        formData.append("organizationName", "Acme Corp");
        formData.append("name", "Test User");
        formData.append("email", "no-model@acme.com");
        formData.append("password", "StrongP@ssw0rd");
        formData.append("agreeTerms", "on");

        const res = await registerAction(null, formData);
        expect(res?.error).toBe("Registration service is temporarily unavailable. Please try again shortly.");
        expect(mockBootstrapTenant).not.toHaveBeenCalled();
        expect(mockCookiesStore.set).not.toHaveBeenCalled();
        expect(mockRedirect).not.toHaveBeenCalled();
      } finally {
        (db as any).User = originalUser;
        (db as any).user = originalUserLower;
      }
    });

    it("succeeds registration and issues session cookies even if trial activation audit log write fails", async () => {
      mockUserModel.findUnique.mockResolvedValueOnce(null);
      mockBootstrapTenant.mockResolvedValueOnce({
        id: "tenant-audit-fail",
        name: "Resilient Org",
        creatorUser: { id: "user-audit-fail", email: "resilient@org.com" },
      });
      const errorWithCode = new Error("AuditLog connection timeout");
      (errorWithCode as any).code = "P2024";
      mockAuditLogModel.create.mockRejectedValueOnce(errorWithCode);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      try {
        const formData = new FormData();
        formData.append("organizationName", "Resilient Org");
        formData.append("name", "Resilient User");
        formData.append("email", "resilient@org.com");
        formData.append("password", "SecurePassword123!");
        formData.append("agreeTerms", "on");

        await expect(registerAction(null, formData)).rejects.toThrow("NEXT_REDIRECT");

        expect(mockBootstrapTenant).toHaveBeenCalledWith("Resilient Org", {
          name: "Resilient User",
          email: "resilient@org.com",
          password_hash: expect.any(String),
        });

        expect(mockCookiesStore.set).toHaveBeenCalledWith(
          "session",
          expect.any(String),
          expect.objectContaining({ httpOnly: true, path: "/" })
        );
        expect(mockCookiesStore.set).toHaveBeenCalledWith(
          "active_tenant_id",
          "tenant-audit-fail",
          expect.objectContaining({ httpOnly: true, path: "/" })
        );
        expect(mockRedirect).toHaveBeenCalledWith("/");

        expect(consoleSpy).toHaveBeenCalledWith(
          "[registerAction] Non-fatal: failed to record trial activation audit log (code: P2024)"
        );
      } finally {
        consoleSpy.mockRestore();
      }
    });

    it("handles concurrent registration email collisions gracefully without internal leaks", async () => {
      mockUserModel.findUnique.mockResolvedValueOnce(null);
      mockBootstrapTenant.mockRejectedValueOnce(
        new Error("duplicate key value violates unique constraint 'User_email_key'")
      );

      const formData = new FormData();
      formData.append("organizationName", "Acme Corp");
      formData.append("name", "Concurrent User");
      formData.append("email", "concurrent@acme.com");
      formData.append("password", "StrongP@ssw0rd");
      formData.append("agreeTerms", "on");

      const res = await registerAction(null, formData);
      expect(res?.error).toBe("An account with this email already exists. Please log in to continue.");
    });

    it("fails cleanly when bootstrap fails without issuing cookies or sessions or leaking internal errors", async () => {
      mockUserModel.findUnique.mockResolvedValueOnce(null);
      mockBootstrapTenant.mockRejectedValueOnce(
        new Error("Database connection dropped at 0xdeadbeef; SQLSTATE 08006")
      );

      const formData = new FormData();
      formData.append("organizationName", "Acme Corp");
      formData.append("name", "Fail User");
      formData.append("email", "fail@acme.com");
      formData.append("password", "StrongP@ssw0rd");
      formData.append("agreeTerms", "true");

      const res = await registerAction(null, formData);
      expect(res?.error).toBe("Failed to complete registration. Please try again.");
      expect(res?.error).not.toContain("Database connection dropped");
      expect(res?.error).not.toContain("0xdeadbeef");
      expect(res?.error).not.toContain("SQLSTATE");
      expect(mockCookiesStore.set).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("successfully creates tenant atomically, sets session and tenant cookies, and redirects to dashboard", async () => {
      mockUserModel.findUnique.mockResolvedValueOnce(null);
      mockBootstrapTenant.mockResolvedValueOnce({
        id: "new-tenant-100",
        name: "Tech Solutions",
        creatorUser: { id: "new-user-1", email: "founder@techsolutions.com" },
      });

      const formData = new FormData();
      formData.append("organizationName", "Tech Solutions");
      formData.append("name", "Carol Founder");
      formData.append("email", "founder@techsolutions.com");
      formData.append("password", "SecurePassword123!");
      formData.append("agreeTerms", "on");

      await expect(registerAction(null, formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockBootstrapTenant).toHaveBeenCalledWith("Tech Solutions", {
        name: "Carol Founder",
        email: "founder@techsolutions.com",
        password_hash: expect.any(String),
      });

      expect(mockCookiesStore.set).toHaveBeenCalledWith(
        "session",
        expect.any(String),
        expect.objectContaining({ httpOnly: true, path: "/" })
      );

      expect(mockCookiesStore.set).toHaveBeenCalledWith(
        "active_tenant_id",
        "new-tenant-100",
        expect.objectContaining({ httpOnly: true, path: "/" })
      );

      expect(mockRedirect).toHaveBeenCalledWith("/");
    });
  });

  describe("2. Invitation Details & Session Identity Awareness", () => {
    it("returns error for invalid / empty token", async () => {
      const res = await getInvitationDetails("");
      expect(res.error).toBe("Invalid invitation link.");
    });

    it("returns error when token hash is not found in database", async () => {
      mockInvitationModel.findFirst.mockResolvedValueOnce(null);

      const res = await getInvitationDetails("non-existent-token");
      expect(res.error).toBe("Invalid invitation link.");
    });

    it("returns error when invitation was already accepted", async () => {
      mockInvitationModel.findFirst.mockResolvedValueOnce({
        id: "inv-accepted",
        status: "ACCEPTED",
      });

      const res = await getInvitationDetails("accepted-token");
      expect(res.error).toContain("already been accepted");
      expect(res.isAccepted).toBe(true);
    });

    it("returns error when invitation has expired", async () => {
      const pastDate = new Date(Date.now() - 3600 * 1000);
      mockInvitationModel.findFirst.mockResolvedValueOnce({
        id: "inv-expired",
        status: "PENDING",
        expires_at: pastDate,
      });

      const res = await getInvitationDetails("expired-token");
      expect(res.error).toContain("expired");
      expect(res.isExpired).toBe(true);
    });

    it("detects when authenticated user matches the invitation email", async () => {
      const futureDate = new Date(Date.now() + 86400 * 1000);
      mockInvitationModel.findFirst.mockResolvedValueOnce({
        id: "inv-match",
        status: "PENDING",
        expires_at: futureDate,
        email: "alice@target.com",
        role: "ENGINEER",
        tenant_id: "tenant-99",
      });
      mockTenantModel.findUnique.mockResolvedValueOnce({
        id: "tenant-99",
        name: "Target Integrations",
      });
      mockUserModel.findUnique.mockResolvedValueOnce({
        id: "user-alice",
        email: "alice@target.com",
        name: "Alice",
      });
      mockGetSession.mockResolvedValueOnce({
        userId: "user-alice",
        email: "alice@target.com",
      });

      const res = await getInvitationDetails("valid-alice-token");
      expect(res.success).toBe(true);
      expect(res.invitation?.isAuthenticatedAsInvitee).toBe(true);
      expect(res.invitation?.isAuthenticatedAsOther).toBe(false);
    });

    it("detects when authenticated user does NOT match the invitation email (account confusion prevention)", async () => {
      const futureDate = new Date(Date.now() + 86400 * 1000);
      mockInvitationModel.findFirst.mockResolvedValueOnce({
        id: "inv-mismatch",
        status: "PENDING",
        expires_at: futureDate,
        email: "alice@target.com",
        role: "ENGINEER",
        tenant_id: "tenant-99",
      });
      mockTenantModel.findUnique.mockResolvedValueOnce({
        id: "tenant-99",
        name: "Target Integrations",
      });
      mockUserModel.findUnique.mockResolvedValueOnce({
        id: "user-alice",
        email: "alice@target.com",
        name: "Alice",
      });
      mockGetSession.mockResolvedValueOnce({
        userId: "user-mallory",
        email: "mallory@evil.com",
      });

      const res = await getInvitationDetails("valid-alice-token");
      expect(res.success).toBe(true);
      expect(res.invitation?.isAuthenticatedAsInvitee).toBe(false);
      expect(res.invitation?.isAuthenticatedAsOther).toBe(true);
      expect(res.invitation?.currentSessionEmail).toBe("mallory@evil.com");
    });
  });

  describe("3. Zero-Knowledge Account Takeover & Cross-Identity Defense", () => {
    it("PREVENTS zero-knowledge account takeover: unauthenticated acceptance for existing user fails without password", async () => {
      const rawToken = "raw-alice-token";
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockInvitationModel.findFirst.mockResolvedValue({
        id: "inv-alice",
        token_hash: tokenHash,
        email: "alice@target.com",
        tenant_id: "tenant-1",
      });

      // User exists with password hash
      const realHash = await hashPassword("AliceRealPassword!");
      mockUserModel.findUnique.mockResolvedValue({
        id: "user-alice",
        email: "alice@target.com",
        password_hash: realHash,
      });

      mockGetSession.mockResolvedValue(null); // Unauthenticated visitor

      const formData = new FormData(); // Attacker sends no password
      const res = await acceptInvitationAction(rawToken, null, formData);

      expect(res?.error).toBe("Please enter your account password to accept this invitation.");
      expect(mockCookiesStore.set).not.toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("PREVENTS zero-knowledge account takeover: unauthenticated acceptance for existing user fails with wrong password", async () => {
      const rawToken = "raw-alice-token";
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockInvitationModel.findFirst.mockResolvedValue({
        id: "inv-alice",
        token_hash: tokenHash,
        email: "alice@target.com",
        tenant_id: "tenant-1",
      });

      const realHash = await hashPassword("AliceRealPassword!");
      mockUserModel.findUnique.mockResolvedValue({
        id: "user-alice",
        email: "alice@target.com",
        password_hash: realHash,
      });

      mockGetSession.mockResolvedValue(null);

      const formData = new FormData();
      formData.append("password", "WrongGuessedPassword!");

      const res = await acceptInvitationAction(rawToken, null, formData);
      expect(res?.error).toBe("Invalid account password. Please try again.");
      expect(mockCookiesStore.set).not.toHaveBeenCalled();
    });

    it("allows unauthenticated acceptance for existing user when correct password is provided", async () => {
      const rawToken = "raw-alice-token";
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const futureDate = new Date(Date.now() + 86400 * 1000);

      mockInvitationModel.findFirst.mockResolvedValue({
        id: "inv-alice",
        token_hash: tokenHash,
        email: "alice@target.com",
        tenant_id: "tenant-1",
        status: "PENDING",
        expires_at: futureDate,
        role: "MEMBER",
      });
      mockInvitationModel.findUnique.mockResolvedValue({
        id: "inv-alice",
        token_hash: tokenHash,
        email: "alice@target.com",
        tenant_id: "tenant-1",
        status: "PENDING",
        expires_at: futureDate,
        role: "MEMBER",
      });

      const realHash = await hashPassword("AliceRealPassword!");
      mockUserModel.findUnique.mockResolvedValue({
        id: "user-alice",
        email: "alice@target.com",
        password_hash: realHash,
      });

      mockTenantMemberModel.findUnique.mockResolvedValue(null);
      mockTenantMemberModel.create.mockResolvedValue({ id: "member-new" });

      mockGetSession.mockResolvedValue(null);

      const formData = new FormData();
      formData.append("password", "AliceRealPassword!");

      await expect(acceptInvitationAction(rawToken, null, formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockCookiesStore.set).toHaveBeenCalledWith(
        "session",
        expect.any(String),
        expect.objectContaining({ httpOnly: true })
      );
      expect(mockCookiesStore.set).toHaveBeenCalledWith(
        "active_tenant_id",
        "tenant-1",
        expect.objectContaining({ httpOnly: true })
      );
      expect(mockRedirect).toHaveBeenCalledWith("/");
    });

    it("BLOCKS cross-identity takeover: logged in user mallory@evil.com cannot accept invite sent to alice@target.com", async () => {
      const rawToken = "raw-alice-token";
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockInvitationModel.findFirst.mockResolvedValue({
        id: "inv-alice",
        token_hash: tokenHash,
        email: "alice@target.com",
        tenant_id: "tenant-1",
      });

      mockGetSession.mockResolvedValue({
        userId: "user-mallory",
        email: "mallory@evil.com",
      });

      const formData = new FormData();
      const res = await acceptInvitationAction(rawToken, null, formData);

      expect(res?.error).toContain("You are currently signed in as mallory@evil.com");
      expect(res?.error).toContain("This invitation was sent to alice@target.com");
      expect(mockCookiesStore.set).not.toHaveBeenCalled();
    });

    it("allows one-click acceptance when visitor is already authenticated as the invited user", async () => {
      const rawToken = "raw-alice-token";
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const futureDate = new Date(Date.now() + 86400 * 1000);

      mockInvitationModel.findFirst.mockResolvedValue({
        id: "inv-alice",
        token_hash: tokenHash,
        email: "alice@target.com",
        tenant_id: "tenant-1",
        status: "PENDING",
        expires_at: futureDate,
        role: "MEMBER",
      });
      mockInvitationModel.findUnique.mockResolvedValue({
        id: "inv-alice",
        token_hash: tokenHash,
        email: "alice@target.com",
        tenant_id: "tenant-1",
        status: "PENDING",
        expires_at: futureDate,
        role: "MEMBER",
      });

      mockUserModel.findUnique.mockResolvedValue({
        id: "user-alice",
        email: "alice@target.com",
      });

      mockTenantMemberModel.findUnique.mockResolvedValue(null);
      mockTenantMemberModel.create.mockResolvedValue({ id: "member-new" });

      mockGetSession.mockResolvedValue({
        userId: "user-alice",
        email: "alice@target.com",
      });

      const formData = new FormData(); // No password needed because session is authenticated as Alice

      await expect(acceptInvitationAction(rawToken, null, formData)).rejects.toThrow("NEXT_REDIRECT");

      expect(mockCookiesStore.set).toHaveBeenCalledWith(
        "active_tenant_id",
        "tenant-1",
        expect.objectContaining({ httpOnly: true })
      );
      expect(mockRedirect).toHaveBeenCalledWith("/");
    });
  });

  describe("4. Concurrency, TOCTOU & Transaction Rollback", () => {
    it("TOCTOU defense: fails atomically inside transaction if status is no longer PENDING", async () => {
      const futureDate = new Date(Date.now() + 86400 * 1000);

      // Invitation in tx is already ACCEPTED (e.g. by concurrent request)
      mockInvitationModel.findUnique.mockResolvedValueOnce({
        id: "inv-concurrent",
        token_hash: "valid-hash",
        status: "ACCEPTED",
        expires_at: futureDate,
      });

      await expect(
        acceptInvitation("inv-concurrent", "raw-token", "pw", "name")
      ).rejects.toThrow("Invitation is already used or cancelled.");

      expect(mockUserModel.create).not.toHaveBeenCalled();
      expect(mockTenantMemberModel.create).not.toHaveBeenCalled();
    });

    it("idempotency: does not fail or duplicate membership if user is already a member", async () => {
      const rawToken = "raw-token-member";
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const futureDate = new Date(Date.now() + 86400 * 1000);

      mockInvitationModel.findUnique.mockResolvedValueOnce({
        id: "inv-idempotent",
        token_hash: tokenHash,
        email: "user@firm.com",
        tenant_id: "tenant-1",
        status: "PENDING",
        expires_at: futureDate,
        role: "MEMBER",
      });

      mockUserModel.findUnique.mockResolvedValueOnce({
        id: "user-1",
        email: "user@firm.com",
      });

      // Membership ALREADY exists
      mockTenantMemberModel.findUnique.mockResolvedValueOnce({
        id: "existing-member-1",
      });

      const result = await acceptInvitation("inv-idempotent", rawToken);

      expect(result.success).toBe(true);
      expect(mockTenantMemberModel.create).not.toHaveBeenCalled(); // No duplicate created
      expect(mockInvitationModel.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "ACCEPTED" }),
        })
      );
    });

    it("rejects token when token hash does not match stored hash", async () => {
      const futureDate = new Date(Date.now() + 86400 * 1000);
      mockInvitationModel.findUnique.mockResolvedValueOnce({
        id: "inv-tamper",
        token_hash: "different-stored-hash",
        email: "tamper@firm.com",
        tenant_id: "tenant-1",
        status: "PENDING",
        expires_at: futureDate,
      });

      await expect(
        acceptInvitation("inv-tamper", "wrong-token", "pw", "name")
      ).rejects.toThrow("Invalid token.");
    });

    it("treats expired session as unauthenticated and enforces password requirement", async () => {
      const rawToken = "raw-alice-token";
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockInvitationModel.findFirst.mockResolvedValue({
        id: "inv-alice",
        token_hash: tokenHash,
        email: "alice@target.com",
        tenant_id: "tenant-1",
      });

      mockUserModel.findUnique.mockResolvedValue({
        id: "user-alice",
        email: "alice@target.com",
        password_hash: "$2a$10$hash",
      });

      // Session is expired/null
      mockGetSession.mockResolvedValue(null);

      const formData = new FormData(); // No password supplied
      const res = await acceptInvitationAction(rawToken, null, formData);

      expect(res?.error).toBe("Please enter your account password to accept this invitation.");
    });

    it("strictly isolates membership creation to the invited tenant (cross-tenant boundary enforcement)", async () => {
      const rawToken = "raw-tenantA-token";
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const futureDate = new Date(Date.now() + 86400 * 1000);

      mockInvitationModel.findUnique.mockResolvedValueOnce({
        id: "inv-tenantA",
        token_hash: tokenHash,
        email: "target@company.com",
        tenant_id: "tenant-A-strictly-isolated",
        status: "PENDING",
        expires_at: futureDate,
        role: "MEMBER",
      });

      mockUserModel.findUnique.mockResolvedValueOnce({
        id: "user-target",
        email: "target@company.com",
      });

      mockTenantMemberModel.findUnique.mockResolvedValueOnce(null);
      mockTenantMemberModel.create.mockResolvedValueOnce({ id: "member-new" });

      const result = await acceptInvitation("inv-tenantA", rawToken);

      expect(result.success).toBe(true);
      expect(result.tenantId).toBe("tenant-A-strictly-isolated");
      expect(mockTenantMemberModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: "tenant-A-strictly-isolated",
            user_id: "user-target",
          }),
        })
      );
    });
  });
});
