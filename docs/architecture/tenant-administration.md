# Tenant Administration Architecture

## Overview
VEYRA's Tenant Administration provides administrators with tools to manage their organization structure, business units, branches, departments, and users.

All administrative actions are strictly scoped to the active tenant context to prevent cross-tenant modifications.

## Organization Hierarchy
- **Organization (Tenant)**: The root level entity. Defines global configurations like timezone, currency, and legal information.
- **Business Units**: Top-level functional or regional divisions within the organization.
- **Branches**: Physical or logical offices that map directly to a Business Unit.
- **Departments**: Functional groupings that map directly to a Branch.

## Tenant Membership & User Lifecycle
- **Users**: Users authenticate into VEYRA universally (via email and password). Their identity is decoupled from any specific tenant.
- **TenantMember**: The many-to-many join table connecting a `User` to a `Tenant`. This table stores the user's tenant-specific role, department, branch, employee code, and status.
- **Invitation Flow**:
  1. A tenant admin creates/invites a user using their email address.
  2. If the user does not exist globally, a `User` record is created. (In a complete implementation, this triggers an invitation email for them to set a password).
  3. A `TenantMember` record is created, granting them access to the specific tenant.
  4. Only users with a `status = "ACTIVE"` can successfully authenticate.

## Administrative Boundaries
Administrative functions (`src/app/admin/actions.ts`) are protected by several layers of security:
1. **`ensureAdmin()`**: Verifies that the active session has the `"ADMIN"` or `"OWNER"` role within the requested tenant.
2. **`getTenantDb()`**: All operations (except those updating the root `Tenant` record itself) utilize the proxy wrapper, automatically appending the `tenant_id` to operations and rejecting cross-tenant identifiers.
3. **Cross-Tenant Prevention**: If an admin attempts to assign a branch to a department, and the branch does not belong to the admin's tenant, the proxy will reject the query.
4. **Audit Logging**: Important administrative modifications (CREATE, UPDATE, DELETE) are logged via the `AuditLog` service.

## Temporary Administrator Authorization
Currently, we employ a simplified role check (`role === "ADMIN" || role === "OWNER"`) on the `TenantMember` record to allow access to organization settings.
This acts as a temporary authorization boundary until the full Role-Based Access Control (RBAC) and Permission Matrix engine is introduced.

## Future RBAC Integration
In upcoming phases, the simple `"ADMIN"` string check will be replaced with granular permissions (e.g., `REQUIRE_PERMISSION('manage_users')`). The core boundaries established here will support that migration natively.
