# Database Schema

## Design Principles
- **Primary Keys**: UUIDs are used for all primary keys to ensure global uniqueness.
- **Tenancy**: Tenant-owned records must include a `tenant_id` foreign key.
- **Auditability**: All models include `created_at` and `updated_at` timestamps.
- **Flexibility**: No customer or tenant-specific logic is hardcoded.

## Foundational Entities

### `Tenant`
Represents an organization or customer using the platform.
- `id` (UUID): Primary key
- `name` (String): Tenant display name
- `domain` (String?): Optional custom domain
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

### `User`
Represents an individual user accessing the platform.
- `id` (UUID): Primary key
- `email` (String, Unique): User's email address
- `name` (String): User's display name
- `tenant_id` (UUID): Foreign key to `Tenant`
- `created_at` (DateTime): Creation timestamp
- `updated_at` (DateTime): Last update timestamp

### CRM Entities

#### `Customer`
Central CRM record representing a client or business entity.
- Tenant-owned (`tenant_id`).
- Unique `customer_number` within the tenant.
- Captures `legal_name`, `display_name`, `customer_type`, `industry`, `status`, and registration identifiers (`gstin`, `pan`).

#### `CustomerContact`
Individuals associated with a `Customer`.
- Tenant-owned (`tenant_id`).
- Links to `Customer` (`customer_id`) and optionally a specific `CustomerSite` (`site_id`).
- Tracks `name`, `email`, `phone`, `designation`, `contact_type`, and `is_primary`.

#### `CustomerSite`
Physical or logical locations for a `Customer`.
- Tenant-owned (`tenant_id`).
- Unique `site_number` within the tenant.
- Captures address, `site_type`, and contact details for the location.

#### `Lead`
Represents a prospective customer or business requirement.
- Tenant-owned (`tenant_id`).
- Tracks `company_name`, `contact_name`, `source`, `status`, and `qualification`.
- Convertible to a `Customer`, `CustomerContact`, and `Opportunity`.

#### `Opportunity`
Represents a potential sale or business transaction linked to a `Customer`.
- Tenant-owned (`tenant_id`).
- Tracks `estimated_value`, `probability`, `expected_close_date`, and sales `stage` / `status`.
- Links to `Customer` and optionally `CustomerContact` and `CustomerSite`.

#### `Activity`
A generic CRM activity associated with any CRM record (Lead, Opportunity, Customer, Contact).
- Tenant-owned (`tenant_id`).
- Types include NOTE, CALL, EMAIL, MEETING, TASK.
