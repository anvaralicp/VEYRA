# VEYRA Platform Architecture

## Overview
VEYRA is a modular, multi-tenant SaaS platform foundation. This document describes the foundational architecture.

## Technology Stack
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL
- **ORM**: Prisma

## Project Structure
- `src/app`: Next.js application routes and pages
- `src/components`: Reusable UI components
- `src/lib`: Utility functions and shared libraries
- `prisma`: Database schema and migrations
- `docs`: Architecture and database documentation

## Modularity
The platform is designed to be modular. Future modules (CRM, Sales, etc.) will be integrated independently into this foundation without hardcoding tenant-specific business logic.

## Tenancy
Data isolation is achieved by associating tenant-owned records with a `tenant_id`.

## Business Modules
- **CRM**: Implements `Customer`, `CustomerContact`, and `CustomerSite`. Accessed via `/crm/customers`. Service logic is located in `src/lib/crm/`.
## Tenant Isolation
See [Tenant Isolation](docs/architecture/tenant-isolation.md) for details on how data privacy is guaranteed.
