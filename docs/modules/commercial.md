# Commercial Module Foundation

## Overview
The VEYRA Commercial module serves as the primary master repository for all billable and tracking-oriented entities that tenants transact with.
It establishes a completely generic structure capable of representing hardware, software licenses, recurring subscriptions, professional services, and consumables.

## Architectural Principles

- **Tenant Isolation**: Every product, category, and manufacturer belongs strictly to the tenant that created it. There is no global product dictionary.
- **Generic Item Type**: Instead of separate tables for "Product" and "Service," a single `ProductService` model is utilized, classified via the `item_type` enum (`PRODUCT`, `SERVICE`, `LICENSE`, `SUBSCRIPTION`, `SUPPORT`, `OTHER`). This enables polymorphic commercial workflows downstream.
- **Soft Deactivation**: Commercial items cannot be hard-deleted because historical quotes, BOQs, and purchase orders will reference them permanently. They use an `is_active` flag. Inactive items disappear from new selection menus but remain intact on historical records.

## Entities

### `ProductService`
The core catalog item.
- Identifiers: `tenant_id` + `item_code` are unique.
- Relations: Points to an optional `ProductCategory` and `Manufacturer`.
- Commercial flags: `is_serialized`, `unit`, `hsn_sac_code`, `tax_code`.

### `ProductCategory`
Enables a hierarchical classification of the product catalog.
- Self-referencing `parent_id` allows infinite depth (e.g., Hardware > Networking > Switches).
- Identifiers: `tenant_id` + `code` are unique.

### `Manufacturer`
Represents the OEM or originator of the product.
- *Note*: This is distinct from a Vendor/Distributor (which will be implemented in future modules). A Cisco switch is manufactured by Cisco but procured from Ingram Micro. The Manufacturer is Cisco.

## Access Control & Permissions

Access is controlled via specific permissions rather than raw DB queries:
- **Products**: `product.view`, `product.create`, `product.update`, `product.deactivate`
- **Categories**: `category.view`, `category.create`, `category.update`, `category.deactivate`
- **Manufacturers**: `manufacturer.view`, `manufacturer.create`, `manufacturer.update`, `manufacturer.deactivate`

The UI and server actions validate these via the standard `requirePermission` boundary.

## Future Extensions (Out of Scope for Foundation)

The foundational models deliberately omit downstream concepts that rely on complex pricing and supply-chain logic:
1. **Costing & Margins**: Landed cost, standard cost, base margin requirements.
2. **Vendors & Distributors**: Supplier mappings and vendor-specific part numbers.
3. **Price Lists & CPQ**: Volume discounting, currency conversions, valid-to dates, and dynamic quotation assembly.
4. **Inventory & Procurement**: Stock levels, serial number tracking, warehousing, and purchase orders.
5. **BOQ Integration**: Currently BOQ lines are freeform text. In a future update, they will support a hybrid approach linking directly to a `ProductService` ID.

### Vendor
The Vendor / Distributor Master for tracking suppliers and partners.
- Tenant Ownership: Every vendor strictly belongs to a specific tenant. There is no global vendor catalog.
- Vendor Types (VendorType): Identifies if the supplier is a DISTRIBUTOR, RESELLER, SYSTEM_INTEGRATOR, OEM, SERVICE_PROVIDER, or OTHER.
- Identifiers: 	enant_id + endor_code are unique.
- Distinction from Manufacturer: Manufacturer represents *who makes* the product (e.g. Cisco). Vendor represents *who supplies/sells* the product to the tenant (e.g. Ingram Micro). A single company can conceptually be both, but they are tracked separately to delineate supply-chain roles.
- Status: Uses is_active for soft deactivation instead of hard deletes to protect historical transactions like Quotes and Purchase Orders.


### ProductVendor
The Product-Vendor mapping establishing sourcing relationships.
- Tenant Ownership: Strictly bounded by 	enant_id. All relationships must point to products and vendors within the same tenant.
- Supplier Attributes: Tracks endor_part_number, lead_time_days, and minimum_order_quantity representing the supplier's specific sourcing traits.
- Preferred Status: is_preferred determines the primary sourcing route for a product. Only one active preferred vendor mapping can exist per product, which is managed safely at the service layer transactionally.
- Limitations: **Pricing and margin logic is strictly OUT OF SCOPE for this relationship.** The relationship maps sourcing routes, but cost schedules/pricing lists belong in future downstream implementations (Task 13).
## Commercial Costing Engine

The Commercial Costing Engine securely evaluates landed costs and target selling prices deterministically using Decimal precision.

### Key Concepts
- **Base Vendor Cost**: Calculated securely via the price engine's tiered overlaps, guaranteeing identical outcomes as endor-price-service.
- **Cost Components**: Supports variable cost additions (Freight, Insurance, Customs, Handling, Other).
  - FIXED_AMOUNT: Always evaluated as a total line-level charge (not per unit).
  - PERCENTAGE_OF_BASE_COST: Applied directly against the line's calculated base subtotal.
- **Landed Cost**: The sum of base cost plus evaluated components, rolled into line totals and unit totals.
- **Selling Price Generation**: Evaluates based on Margin (Gross Margin \% over Revenue) or Markup (Gross \% over Cost).

### Guardrails (Tenant Configured)
- **Minimum Margin \%**: Hard reject on calculation if margin is breached.
- **Maximum Markup \%**: Hard reject on calculation if markup is breached.
- **Zero Cost Handling**: If base cost resolves to 0, margin equations safely substitute 0 to prevent division errors.

**Note**: The calculations performed here are strictly ephemeral simulation instances. They are NOT approved quotes and are NOT persisted historically outside of Audit trails for settings.
