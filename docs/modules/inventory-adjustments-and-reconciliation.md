# Inventory Adjustments & Reconciliation

This document outlines the workflow and architectural decisions for the Stock Adjustments and Reconciliation capabilities implemented in VEYRA (Task 21).

## 1. Objective and Scope
The module provides a secure, auditable stock correction capability. It is intended to fix discrepancies between physical counts and system balances without rewriting or deleting authoritative historical ledger entries. It establishes physical stock counts as the prerequisite for creating stock adjustments.

**In Scope:**
- Draft physical stock counts with snapshot expected balances.
- Server-side variance calculation.
- Adjustment request generation based on count discrepancies.
- "Stale count" prevention ensuring no adjustment applies to shifting inventory baselines.
- Explicit stock adjustment approval posting and immutable ledger logging.
- Reconciliation service that compares ledger movements against active stock locations.

**Out of Scope:**
- Warehouse transfers or bin-level logistics.
- Stock picking, reservation, or fulfillment order generation.
- Serial number, lot tracking, or expiration date validation.
- Advanced automated warehouse robotics integrations.

## 2. Core Workflows

### A. Stock Count Lifecycle
The count process establishes a verified snapshot of the expected inventory to anchor the physical count.
1. **DRAFT:** An authorized user opens a count for an active stock location.
2. **RECORDING:** Users input physical quantities for stockable items. The system captures the `snapshot_date` and expected ledger balance simultaneously, freezing the context for that item.
3. **SUBMITTED:** The count is finalized and marked for review. It generates DRAFT Inventory Adjustments for every item with a non-zero variance.
4. **POSTED:** When the generated adjustments are approved/posted, the count transitions to POSTED, finalizing the operation.

### B. Variance Sign Conventions
Variance is strictly calculated as:
`Variance = Physical Count - Expected System Quantity`
- **Positive Variance:** More stock was found physically than the ledger showed (requires a positive stock ledger movement).
- **Negative Variance:** Less stock was found physically than the ledger showed (requires a negative stock ledger movement).

*Note: The physical count must never be negative.*

### C. Stale Count Prevention
Because warehouse operations can continue while a stock count is performed, VEYRA enforces a strict staleness protection rule. When posting a variance adjustment derived from a count, the system dynamically checks `InventoryLedger` for any movements logged for that item *after* the item's `snapshot_date`.
- If subsequent movements exist (delta is non-zero), the count is deemed **stale**. The adjustment is blocked, requiring the user to refresh the count against the new baseline.

### D. Reconciling Differences
VEYRA uses the `InventoryLedger` as the absolute source of truth. As there is no materialized, diverging "current_balance" table, the reconciliation service reports the dynamically aggregated total of all ledger entries for an item. The only discrepancies in the application arise from physical reality diverging from the ledger, which must be addressed via the Stock Count -> Adjustment workflow.

## 3. Data Model

- **StockCount:** Represents the header for a physical counting session.
- **StockCountLine:** Represents an item being counted, carrying the expected quantity, physical quantity, variance, and the precise timestamp the snapshot was taken.
- **InventoryAdjustment:** Represents a validated request to alter the ledger. Carries `adjustment_type` (e.g. `COUNT_VARIANCE`, `DAMAGE`, `LOSS`), requested/posted user details, and the finalized quantity delta.
- **InventoryLedger (Extension):** The existing ledger was extended with an `inventory_adjustment_id` relation and an `ADJUSTMENT` movement type to formally ingest posted corrections.

## 4. RBAC & Security

The following permissions manage the module:
- `inventory.count.view`, `inventory.count.create`, `inventory.count.update`, `inventory.count.submit`
- `inventory.adjustment.view`, `inventory.adjustment.create`, `inventory.adjustment.update`, `inventory.adjustment.submit`, `inventory.adjustment.approve`, `inventory.adjustment.post`
- `inventory.reconciliation.view`

Adjustments require explicit user association. Only authorized Operations Managers or Administrators possess the `inventory.adjustment.post` permission to commit changes to the ledger. All ledger alterations generate immutable `INVENTORY_ADJUSTMENT_POSTED` audit records.
