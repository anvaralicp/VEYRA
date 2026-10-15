# CRM Module

## Overview
The CRM (Customer Relationship Management) module is the foundational business module of VEYRA. The central entity is the `Customer`, representing an external organization or individual that the Tenant does business with.

## Scope
Currently implements the Customer 360 foundational view:
- **Customer**: Core company/client record with legal name, registration details (GSTIN, PAN).
- **CustomerContact**: Primary, technical, commercial contacts associated with the Customer.
- **CustomerSite**: Physical/logical branches, head offices, and warehouses.

## Service Boundaries
All cross-module communication should route through `src/lib/crm/customer-service.ts`.
- `getCustomerById(id)`
- `getCustomers(query)`
- `createCustomer(data)`
- `updateCustomer(id, data)`

## Tenant Isolation
The CRM operates strictly within the current Tenant Context.
Customer, Contact, and Site models have a `tenant_id` which acts as the boundary.

## Navigation
The primary entry point is the Customer List Page located at `/crm/customers`.

## Role-Based Access (RBAC)
Permissions required for CRM operations:
- `customer.view`, `customer.create`, `customer.update`, `customer.delete`
- `contact.view`, `contact.create`, `contact.update`, `contact.delete`
- `site.view`, `site.create`, `site.update`, `site.delete`
- `lead.view`, `lead.create`, `lead.update`, `lead.delete`, `lead.convert`
- `opportunity.view`, `opportunity.create`, `opportunity.update`, `opportunity.delete`, `opportunity.close`
- `activity.view`, `activity.create`, `activity.update`, `activity.delete`

## Sales Flow (Lead to Opportunity)
1. **Lead**: Prospects are captured in `/crm/leads`. Leads hold initial qualification data.
2. **Conversion**: A Lead is converted via atomic transaction (`convertLeadAction`). This creates:
   - A `Customer` (or links an existing one)
   - A `CustomerContact`
   - An `Opportunity` linked to the customer.
3. **Opportunity**: Tracks the sales pipeline in `/crm/opportunities`. Represents potential revenue.
4. **Pipeline**: Visualizes open opportunities across configurable stages (`/crm/opportunities/pipeline`).
5. **Activity**: Generic tasks, calls, and meetings associated with Leads, Opportunities, and Customers.
