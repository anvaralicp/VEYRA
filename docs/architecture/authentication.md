# Authentication Architecture

## Overview
The VEYRA platform utilizes a custom JWT-based authentication system backed by robust hashing, designed for secure B2B access. This document details the session architecture, password handling, and integration with the existing tenant isolation.

## Important Architectural Rule
Authentication and tenant isolation are kept strictly separate:
- **Authentication**: Answers *"Who is this user?"* (Identifies the user via email/password).
- **Tenant Context**: Answers *"Which organization is this request operating under?"* (Identifies the organization).

Authentication NEVER implies authorization for tenant data. The user's resolved `userId` from the authentication session must be passed to the tenant resolution layer, which verifies DB membership to establish the Tenant Context.

## Session Architecture
- **JWT (JSON Web Tokens)**: A signed JWT contains the `userId` and `email`. It is encrypted using `jose` with `HS256`.
- **Cookies**: The JWT is delivered strictly via `httpOnly`, `Secure`, `SameSite=Lax` cookies, shielding it from XSS and CSRF attacks.
- **Expiration**: The session has a standard rolling expiration (currently set to 24 hours).
- **Middleware**: `src/middleware.ts` guards the application route tree, intercepting unauthenticated requests and redirecting them to `/login`.

## Password Handling
- Passwords are **never** stored in plaintext.
- We utilize `bcryptjs` for secure key stretching and hashing (10 salt rounds).
- Password validation occurs server-side during the Next.js `loginAction`.
- The login action mitigates timing attacks by generating dummy hash validations when users are not found, preventing attackers from determining whether an email address exists in the system.

## Protected Routes
- Next.js middleware guards standard routes.
- **`requireAuthenticatedUser()`**: Used within server components and server actions to strictly verify the session token and extract the identity without needing the complete Next.js `Request` object.

## Relationship with Tenant Context & Isolation
1. **Authenticated Session**: Retrieves the `userId` from the JWT cookie.
2. **Tenant Membership**: `getTenantContext()` uses this verified `userId` combined with the requested `tenantId` to query the `TenantMember` join table.
3. **Active Tenant**: Upon verification, the context is successfully initialized.
4. **Tenant DB**: The proxy `getTenantDb()` intercepts queries and enforces the verified `tenant_id` on all tenant-owned models.

### Developer Rules
- **DO NOT** store the session secret or passwords in client-exposed state.
- **DO NOT** attempt to write session values containing `tenant_id` claims, as users may belong to multiple tenants. Always let `getTenantContext()` resolve it.
- **DO NOT** skip `requireAuthenticatedUser()` in server actions unless they are explicitly public (e.g., login).
