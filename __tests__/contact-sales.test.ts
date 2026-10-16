/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateReferenceNumber,
  persistSalesEnquiry,
  checkRateLimit,
  isDuplicateSubmission,
  clearRateLimits,
} from "../src/lib/sales/enquiry-store";
import { submitContactSalesAction } from "../src/app/contact-sales/actions";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockImplementation((header: string) => {
      if (header === "x-forwarded-for") return "192.168.1.100";
      return null;
    }),
  }),
}));

describe("Contact Sales Persistence & Security Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRateLimits();
  });

  describe("1. Reference Number Uniqueness & Generation", () => {
    it("generates reference numbers with the ENQ- prefix and correct format", () => {
      const ref = generateReferenceNumber();
      expect(ref).toMatch(/^ENQ-[0-9A-Z]+-[0-9A-F]{6}$/);
    });

    it("generates 1,000 reference numbers with zero collisions", () => {
      const refs = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        refs.add(generateReferenceNumber());
      }
      expect(refs.size).toBe(1000);
    });
  });

  describe("2. Database Persistence via persistSalesEnquiry", () => {
    it("persists enquiry to database and returns complete record", async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: "enq-uuid-1",
        reference_number: "ENQ-TEST-123456",
        contact_name: "Sarah Connor",
        email: "sarah@cyberdyne.com",
        company: "Cyberdyne Systems",
        phone: "+1-555-0199",
        user_count: "50-200",
        modules: JSON.stringify(["crm", "procurement"]),
        message: "Requesting demo for 150 seats",
        ip_address: "127.0.0.1",
        status: "NEW",
        created_at: new Date("2026-10-16T00:00:00Z"),
      });

      const mockClient = {
        orm: {
          public: {
            SalesEnquiry: {
              create: mockCreate,
            },
          },
        },
      };

      const result = await persistSalesEnquiry(
        {
          name: "Sarah Connor",
          email: "sarah@cyberdyne.com",
          organization: "Cyberdyne Systems",
          phone: "+1-555-0199",
          userCount: "50-200",
          modules: ["crm", "procurement"],
          message: "Requesting demo for 150 seats",
          ipAddress: "127.0.0.1",
        },
        { client: mockClient }
      );

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          contact_name: "Sarah Connor",
          email: "sarah@cyberdyne.com",
          company: "Cyberdyne Systems",
          phone: "+1-555-0199",
          user_count: "50-200",
          status: "NEW",
        })
      );

      expect(result.id).toBe("enq-uuid-1");
      expect(result.referenceNumber).toBe("ENQ-TEST-123456");
      expect(result.name).toBe("Sarah Connor");
      expect(result.organization).toBe("Cyberdyne Systems");
      expect(result.modules).toEqual(["crm", "procurement"]);
    });

    it("retries on unique reference number collision and succeeds", async () => {
      const mockCreate = vi
        .fn()
        .mockRejectedValueOnce({
          code: "P2002",
          message: "Unique constraint failed on the fields: (`reference_number`)",
        })
        .mockResolvedValueOnce({
          id: "enq-uuid-retry",
          reference_number: "ENQ-RETRY-SUCCESS",
          contact_name: "Alice Smith",
          email: "alice@acme.com",
          company: "Acme Corp",
          status: "NEW",
          created_at: new Date(),
        });

      const mockClient = {
        SalesEnquiry: {
          create: mockCreate,
        },
      };

      const result = await persistSalesEnquiry(
        {
          name: "Alice Smith",
          email: "alice@acme.com",
          organization: "Acme Corp",
          userCount: "10-50",
          modules: ["crm"],
        },
        { client: mockClient, maxRetries: 3 }
      );

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(result.referenceNumber).toBe("ENQ-RETRY-SUCCESS");
    });

    it("fails cleanly when database write throws unrecoverable error", async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error("Database connection pool exhausted"));
      const mockClient = {
        SalesEnquiry: {
          create: mockCreate,
        },
      };

      await expect(
        persistSalesEnquiry(
          {
            name: "Bob Jones",
            email: "bob@acme.com",
            organization: "Acme Corp",
            userCount: "10-50",
            modules: [],
          },
          { client: mockClient }
        )
      ).rejects.toThrow("Durable enquiry persistence failed");
    });
  });

  describe("3. Form Input Validation in submitContactSalesAction", () => {
    it("rejects names shorter than 2 characters", async () => {
      const formData = new FormData();
      formData.set("name", "A");
      formData.set("email", "valid@company.com");
      formData.set("organization", "Company Inc");

      const res = await submitContactSalesAction(null, formData);
      expect(res.error).toBe("Please provide your full name (minimum 2 characters).");
      expect(res.success).toBeUndefined();
      expect(res.fields?.name).toBe("A");
    });

    it("rejects invalid email formats", async () => {
      const formData = new FormData();
      formData.set("name", "Valid Name");
      formData.set("email", "not-an-email");
      formData.set("organization", "Company Inc");

      const res = await submitContactSalesAction(null, formData);
      expect(res.error).toBe("Please enter a valid work email address.");
      expect(res.success).toBeUndefined();
    });

    it("rejects missing or whitespace organization name", async () => {
      const formData = new FormData();
      formData.set("name", "Valid Name");
      formData.set("email", "valid@company.com");
      formData.set("organization", "   ");

      const res = await submitContactSalesAction(null, formData);
      expect(res.error).toBe("Please provide your organization name.");
      expect(res.success).toBeUndefined();
    });
  });

  describe("4. Duplicate Submission & Rate Limiting Defense", () => {
    it("detects rapid duplicate submissions from the same email and organization", () => {
      const key = "test@company.com-company inc";
      expect(isDuplicateSubmission(key, 10000)).toBe(false);
      // Second attempt within window
      expect(isDuplicateSubmission(key, 10000)).toBe(true);
    });

    it("rejects duplicate submissions in submitContactSalesAction", async () => {
      const formData = new FormData();
      formData.set("name", "Alex Mercer");
      formData.set("email", "alex@gentek.com");
      formData.set("organization", "Gentek");

      // Simulate a previous submission that registered fingerprint
      isDuplicateSubmission("alex@gentek.com-gentek", 15000);

      // Now call action with same details
      const duplicateRes = await submitContactSalesAction(null, formData);
      expect(duplicateRes.error).toBe(
        "A submission with these details was recently received. Please allow our team time to respond."
      );
      expect(duplicateRes.success).toBeUndefined();
      expect(duplicateRes.fields?.name).toBe("Alex Mercer");
    });

    it("enforces rate limits per IP and email identifier", () => {
      const identifier = "10.0.0.1-user@test.com";
      expect(checkRateLimit(identifier, 3, 60000)).toBe(true);
      expect(checkRateLimit(identifier, 3, 60000)).toBe(true);
      expect(checkRateLimit(identifier, 3, 60000)).toBe(true);
      expect(checkRateLimit(identifier, 3, 60000)).toBe(false);
    });
  });

  describe("5. End-to-End Success & Failure Handling in Action", () => {
    it("returns success and enquiryId when database persistence succeeds", async () => {
      const formData = new FormData();
      formData.set("name", "Clark Kent");
      formData.set("email", "clark@dailyplanet.com");
      formData.set("organization", "Daily Planet");
      formData.set("phone", "+1-555-0100");
      formData.set("userCount", "50-200");
      formData.append("modules", "crm");
      formData.append("modules", "projects");
      formData.set("message", "Inquiry for editorial teams");

      const mockCreate = vi.fn().mockResolvedValue({
        id: "enq-clark-uuid",
        reference_number: "ENQ-CLARK-REF1",
        contact_name: "Clark Kent",
        email: "clark@dailyplanet.com",
        company: "Daily Planet",
        status: "NEW",
        created_at: new Date(),
      });

      // Temporarily mock db.orm.public.SalesEnquiry.create
      const { db } = await import("../src/prisma/db");
      const originalOrm = (db as any).orm;
      (db as any).orm = {
        public: {
          SalesEnquiry: {
            create: mockCreate,
          },
        },
      };

      try {
        const res = await submitContactSalesAction(null, formData);
        expect(res.success).toBe(true);
        expect(res.enquiryId).toBe("ENQ-CLARK-REF1");
        expect(res.error).toBeUndefined();
      } finally {
        (db as any).orm = originalOrm;
      }
    });

    it("returns sanitized error message on database persistence failure without leaking internals", async () => {
      const formData = new FormData();
      formData.set("name", "Bruce Wayne");
      formData.set("email", "bruce@wayneenterprises.com");
      formData.set("organization", "Wayne Enterprises");

      const mockCreate = vi.fn().mockRejectedValue(new Error("FATAL: connection pool exhausted at PostgreSQL server"));

      // Temporarily mock db.orm.public.SalesEnquiry.create
      const { db } = await import("../src/prisma/db");
      const originalOrm = (db as any).orm;
      (db as any).orm = {
        public: {
          SalesEnquiry: {
            create: mockCreate,
          },
        },
      };

      // Mock console.error to check no PII is logged
      const loggedErrors: string[] = [];
      const errorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
        loggedErrors.push(args.join(" "));
      });

      try {
        const res = await submitContactSalesAction(null, formData);

        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(res.success).toBeUndefined();
        expect(res.enquiryId).toBeUndefined();
        expect(res.error).toBe(
          "Unable to submit your enquiry at this moment. Please try again shortly or reach out to support."
        );
        expect(res.error).not.toContain("FATAL");
        expect(res.error).not.toContain("PostgreSQL");
        expect(res.error).not.toContain("connection pool");
        expect(res.fields?.organization).toBe("Wayne Enterprises");

        // Check log sanitization: no emails or messages in error output
        for (const log of loggedErrors) {
          expect(log).not.toContain("bruce@wayneenterprises.com");
        }
      } finally {
        (db as any).orm = originalOrm;
        errorSpy.mockRestore();
      }
    });
  });
});
