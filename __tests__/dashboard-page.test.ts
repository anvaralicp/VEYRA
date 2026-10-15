/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import DashboardPage from "../src/app/(authenticated)/dashboard/page";

const {
  mockRequireAuthenticatedUser,
  mockDb,
} = vi.hoisted(() => {
  const userFindUnique = vi.fn();

  return {
    mockRequireAuthenticatedUser: vi.fn(),
    mockDb: {
      orm: {
        public: {
          User: {
            where: vi.fn((w: any) => ({
              first: () => userFindUnique(w),
            })),
          },
        },
      },
      userFindUnique,
    },
  };
});

vi.mock("../src/prisma/db", () => ({
  db: mockDb,
}));

vi.mock("../src/lib/auth/boundary", () => ({
  requireAuthenticatedUser: () => mockRequireAuthenticatedUser(),
}));

// Mock icons and layout UI components
vi.mock("../src/components/ui/page-header", () => ({
  PageHeader: ({ title, description }: any) =>
    React.createElement("div", { "data-testid": "page-header", title, description }),
}));

vi.mock("../src/components/ui/content-container", () => ({
  ContentContainer: ({ children, className }: any) =>
    React.createElement("div", { "data-testid": "content-container", className }, children),
}));

describe("DashboardPage (Prisma 8 Runtime & Model Resolution)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("successfully resolves User from Prisma 8 db.orm.public.User and displays first name", async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      userId: "user-123",
      email: "jane.doe@enterprise.com",
    });

    mockDb.userFindUnique.mockResolvedValue({
      id: "user-123",
      name: "Jane Doe",
      email: "jane.doe@enterprise.com",
    });

    const jsx: any = await DashboardPage();

    expect(jsx).toBeDefined();
    // Verify children includes PageHeader with user's first name
    const pageHeader = jsx.props.children[0];
    expect(pageHeader.props.title).toBe("Good morning, Jane");
  });

  it("falls back cleanly to email prefix when user record is null", async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      userId: "user-456",
      email: "alexander@enterprise.com",
    });

    mockDb.userFindUnique.mockResolvedValue(null);

    const jsx: any = await DashboardPage();

    expect(jsx).toBeDefined();
    const pageHeader = jsx.props.children[0];
    expect(pageHeader.props.title).toBe("Good morning, alexander");
  });

  it("falls back to email prefix when user has no name field", async () => {
    mockRequireAuthenticatedUser.mockResolvedValue({
      userId: "user-789",
      email: "support@enterprise.com",
    });

    mockDb.userFindUnique.mockResolvedValue({
      id: "user-789",
      name: null,
      email: "support@enterprise.com",
    });

    const jsx: any = await DashboardPage();

    expect(jsx).toBeDefined();
    const pageHeader = jsx.props.children[0];
    expect(pageHeader.props.title).toBe("Good morning, support");
  });
});
