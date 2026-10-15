# Tenant Isolation Architecture

## Overview
VEYRA is a multi-tenant platform. To guarantee data privacy and security, all database operations involving tenant-owned records must occur within an authenticated tenant context.

We enforce isolation dynamically at the database access layer, preventing accidental cross-tenant data leaks by application developers.

## How Tenant Context is Established

1. **Authentication**: The user's session is established via `requireAuthenticatedUser()` (e.g. JWT, Next-Auth).
2. **Context Resolution**: The context is built per-request via `getTenantContext()`.
3. **Verification**: `getTenantContext()` checks the session against the `TenantMember` database table to verify that the authenticated user explicitly belongs to the requested `tenantId`.

**Client-provided `tenantId` is NEVER trusted implicitly.**

## How Tenant Isolation Works

We provide a specialized wrapper over the Prisma Client via `getTenantDb()`.
When a developer calls `const db = await getTenantDb();`, the wrapper uses a JavaScript Proxy to intercept all queries to tenant-owned models (e.g., `Customer`).

For any operation, the wrapper automatically injects the verified `tenantId` from the context:
- `findMany`, `count`, `updateMany`, `deleteMany`: The `tenant_id` is appended to the `where` clause.
- `create`, `createMany`: The `tenant_id` is automatically injected into the payload.
- `update`, `delete`, `findUnique`: A pre-flight check validates that the record actually belongs to the active tenant before allowing the mutation.

## How developers must query tenant-owned data

**CORRECT:**
```typescript
import { getTenantDb } from "@/lib/db/tenant-db";

// Always use getTenantDb() in server actions/route handlers
export async function getCustomers() {
  const db = await getTenantDb();
  // Automatically scoped to the current tenant!
  return await db.Customer.findMany();
}
```

## What developers must NOT do

**INCORRECT (Do NOT bypass isolation):**
```typescript
import { db } from "@/prisma/db"; // ❌ Direct access to raw DB is forbidden for tenant logic

export async function getCustomersUnsafe(tenantId: string) {
  // ❌ Trusting client-provided tenantId without verifying membership
  return await db.Customer.findMany({ where: { tenant_id: tenantId } });
}
```

## Security Summary
- **No tenant-owned query can execute without tenant context** (attempting to use `getTenantDb` unauthenticated throws an error).
- **Client-supplied tenant_id cannot override authenticated tenant context** (the proxy overwrites whatever `tenant_id` the client tries to supply in the payload).
