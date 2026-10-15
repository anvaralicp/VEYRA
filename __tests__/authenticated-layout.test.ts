/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import AuthenticatedLayout from "../src/app/(authenticated)/layout";

const {
  mockRequireAuthenticatedUser,
  mockGetTenantContext,
  mockGetAllUserPermissions,
  mockRedirect,
  mockAppShell,
  mockDb,
} = vi.hoisted(() => {
  const tenantFindUnique = vi.fn();
  const userFindUnique = vi.fn();

  return {
    mockRequireAuthenticatedUser: vi.fn(),
    mockGetTenantContext: vi.fn(),
    mockGetAllUserPermissions: vi.fn(),
    mockRedirect: vi.fn(),
    mockAppShell: vi.fn((props: any) => React.createElement("div", { "data-testid": "app-shell", ...props })),
    mockDb: {
      orm: {
        public: {
          Tenant: {
            where: vi.fn((w: any) => ({
              first: () => tenantFindUnique(w),
            })),
          },
          User: {
            where: vi.fn((w: any) => ({
              first: () => userFindUnique(w),
            })),
          },
        },
      },
      tenantFindUnique,
      userFindUnique,
    },
  };
});

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    mockRedirect(url);
    const err = new Error("NEXT_REDIRECT");
    (err as any).digest = `NEXT_REDIRECT;replace;${url};307;;`;
    throw err;
  }),
}));

vi.mock("../src/components/layout/AppShell", () => ({
  AppShell: (props: any) => mockAppShell(props),
}));

vi.mock("../src/lib/auth/boundary", () => ({
  requireAuthenticatedUser: () => mockRequireAuthenticatedUser(),
  getAllUserPermissions: () => mockGetAllUserPermissions(),
}));

vi.mock("../src/lib/tenant/context", () => ({
  getTenantContext: () => mockGetTenantContext(),
}));

vi.mock("../src/prisma/db", () => ({
  db: mockDb,
}));

describe("AuthenticatedLayout: Tenant Model Lookup and Runtime Resilience", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllUserPermissions.mockResolvedValue(["crm.view", "quotation.view"]);
  });

  it("TEST A: Successfully looks up Tenant and User in Prisma 8 format and passes branding to AppShell", async () => {
    mockRequireAuthenticatedUser.mockResolvedValueOnce({
      userId: "user-123",
      email: "alice@acme.com",
    });

    mockGetTenantContext.mockResolvedValueOnce({
      tenantId: "tenant-456",
      userId: "user-123",
      role: "OWNER",
    });

    mockDb.tenantFindUnique.mockResolvedValueOnce({
      id: "tenant-456",
      name: "Acme Systems Ltd",
    });

    mockDb.userFindUnique.mockResolvedValueOnce({
      id: "user-123",
      name: "Alice Engineer",
      email: "alice@acme.com",
    });

    const jsx: any = await AuthenticatedLayout({ children: React.createElement("div", null, "Dashboard Content") });

    expect(jsx).toBeDefined();
    expect(jsx.props).toEqual(
      expect.objectContaining({
        user: { name: "Alice Engineer", email: "alice@acme.com" },
        organization: { name: "Acme Systems Ltd" },
        permissions: ["crm.view", "quotation.view"],
      })
    );
  });

  it("TEST B: Safely falls back to default organization and user names when records are missing without crashing", async () => {
    mockRequireAuthenticatedUser.mockResolvedValueOnce({
      userId: "user-999",
      email: "bob@company.com",
    });

    mockGetTenantContext.mockResolvedValueOnce({
      tenantId: "tenant-missing",
      userId: "user-999",
      role: "MEMBER",
    });

    // Tenant and User queries return null
    mockDb.tenantFindUnique.mockResolvedValueOnce(null);
    mockDb.userFindUnique.mockResolvedValueOnce(null);

    const jsx: any = await AuthenticatedLayout({ children: React.createElement("div", null, "Dashboard Content") });

    expect(jsx).toBeDefined();
    expect(jsx.props).toEqual(
      expect.objectContaining({
        user: { name: "bob", email: "bob@company.com" },
        organization: { name: "My Organization" },
        permissions: ["crm.view", "quotation.view"],
      })
    );
  });

  it("TEST C: Redirects unauthenticated users to /login", async () => {
    mockRequireAuthenticatedUser.mockRejectedValueOnce(new Error("UNAUTHORIZED"));

    await expect(
      AuthenticatedLayout({ children: React.createElement("div", null, "Dashboard Content") })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("TEST D: Redirects users without an active tenant to /select-tenant", async () => {
    mockRequireAuthenticatedUser.mockResolvedValueOnce({
      userId: "user-123",
      email: "alice@acme.com",
    });

    mockGetTenantContext.mockRejectedValueOnce(new Error("MULTIPLE_TENANTS"));

    await expect(
      AuthenticatedLayout({ children: React.createElement("div", null, "Dashboard Content") })
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mockRedirect).toHaveBeenCalledWith("/select-tenant");
  });
});
