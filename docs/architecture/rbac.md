# VEYRA RBAC and Permissions Engine

## Concept Overview
VEYRA's authorization architecture is designed with three strict independent boundaries:
1. **Authentication** (`Who is the user?`) - Unlocked via JWT HttpOnly cookie (User model).
2. **Tenant Context** (`Which tenant is this request operating under?`) - Evaluated per request via `getTenantContext()`. A user's memberships are mapped by the `TenantMember` join table.
3. **Role-Based Access Control** (`What can this user do?`) - Determined via the combination of `Permission`, `Role`, `RolePermission`, and `MemberRole`.

## Tenant-Scoped Roles
While permissions are strictly defined globally by the platform (e.g., `customer.create`, `role.view`), **Roles** are fully tenant-scoped.

Example: A user (`Alice`) can possess the `SALES_MANAGER` role in `Tenant A` and the `GUEST` role in `Tenant B`.
When Alice connects under `Tenant A`, the system exclusively evaluates `Tenant A` roles.

## Permission Evaluation (`requirePermission`)
The server-side enforcement evaluates access via:
```javascript
Authenticated User -> Tenant Context -> Tenant Membership -> Tenant Roles (Array) -> Role Permissions -> Requested Permission
```
If a user is assigned multiple roles, their effective permissions are the **union** of all active assignments. If a role is marked `INACTIVE`, its associated permissions are safely discarded during evaluation.

**Code Example:**
```typescript
import { requirePermission } from "@/lib/auth/boundary";

export async function createCustomer(data) {
  await requirePermission("customer.create");
  // Proceed with creation
}
```

## Owner Safety Protections
The platform natively protects the `OWNER` role from accidental lockout.
1. An administrator cannot deactivate the final `OWNER` role using the Roles administration interface.
2. An administrator cannot remove the `OWNER` role from the final user that possesses it.
3. The `OWNER` role natively bypasses permission checks as the absolute root authority inside the tenant context.

## System Permission Catalog
Platform permissions are seeded structurally by VEYRA using an idempotent seeding script (`src/lib/tenant/bootstrap.ts`).
This catalog represents an authoritative, globally consistent set of actions (e.g., `customer.create`, `ticket.resolve`).
Tenant Administrators **cannot** create new permission keys, modify permission semantics, rename keys, or delete system permissions. This ensures the backend contract remains 100% stable across all tenants.

## System Role Templates
VEYRA defines standard role templates (e.g., `OWNER`, `ADMIN`, `SALES`, `FINANCE`) in `src/lib/auth/roles.ts`.
These are seeded into the tenant database upon creation. Once seeded, they act as standard tenant-owned roles that can be managed by the tenant's administrators. They are not global shared instances; they are uniquely owned records per tenant.

## Tenant Bootstrap
When a new tenant is instantiated, the system calls `bootstrapTenant()`. This automatically:
1. Verifies/Upserts the global permission definitions.
2. Creates the Tenant record.
3. Clones the System Role Templates into the tenant.
4. Populates default sensible `RolePermission` mappings based on the templates.
5. Issues a `TenantMember` linkage for the creator and strictly binds them to the `OWNER` role.
This mechanism removes any requirement for manual administrative configuration upon initial sign-up.
