# Procurement Management

## Overview
The Procurement Management module establishes internal supplier purchase orders derived from fulfilment requirements. It represents VEYRA's commitment to vendors to purchase products or services.

## Schema Relationships
- **Supplier PO**: Links securely to an active Vendor and a single Currency. Maintains its own immutable numbering scheme (`SPO-*`).
- **Allocations**: Procurement explicitly allocates quantities against `FulfilmentOrderLine`s via the `FulfilmentAllocation` model. A single fulfilment line can be fulfilled by multiple supplier POs, but the system calculates the remaining `planned_quantity` and strictly prohibits over-allocation.
- **Vendor Pricing Rules**: `SupplierPurchaseOrderLine` can reference a specific `VendorPrice` ID. Server logic validates minimum quantity breaks, expiration dates, and currency bounds before allowing the line to be saved. Freeform items are fully supported and retain user-supplied snapshots.

## Lifecycle Enforcement
Supplier POs follow an auditable state machine:
- `DRAFT`: Edits permitted.
- `PENDING_APPROVAL`: Commercial fields locked. Awaiting manager approval.
- `APPROVED`: Revisions are blocked. Ready for issue. (Separation of duties prohibits self-approval of procurement documents).
- `ISSUED`: Immutable snapshot. System logs issuance date.
- `ACKNOWLEDGED`: Explicit vendor acceptance logged.
- `ON_HOLD` / `CANCELLED` / `CLOSED`: Terminal or suspended workflow states.

## Security & Concurrency
- `tdb.$transaction` explicitly locks the commercial allocation boundary to calculate remaining quantities efficiently without race condition overlaps.
- Role-based separation guarantees that a creator cannot jump states, and `requirePermission()` blocks execution if RBAC headers are forged.
- The `getPrintableSupplierPO()` utility sanitizes outputs by explicitly stripping internal margin and backend notes before returning data.
