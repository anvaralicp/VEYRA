# Customer Purchase Orders

## Overview
The Customer Purchase Order (PO) module tracks external purchase orders received from customers. It establishes a formal hand-off between sales quoting and commercial order execution.

Customer POs validate the customer's intent to buy against the exact, immutable snapshot of an issued Quotation Revision.

**Note**: This module tracks *received* POs from customers, not internal vendor procurement orders.

## Architecture & Lifecycle
Customer POs are isolated by tenant and enforce strict lifecycle statuses:

1. **DRAFT**: The PO is being registered. It has not been validated.
2. **SUBMITTED**: The PO registration is complete and is awaiting managerial validation.
3. **VALIDATED**: The PO matches commercial reality, resolves all validation issues, and is accepted internally.
4. **RETURNED**: The PO registration requires clarification or correction by the sales rep.
5. **REJECTED**: The PO is declined and locked.

Validation operations are permanently logged to `CustomerPurchaseOrderValidation`, recording reviewer commentary, status changes, and all detected commercial discrepancies.

## Validation Engine
The server-side Validation Engine (`generatePOValidationFindings`) systematically detects commercial discrepancies between the registered customer PO and its associated `QuotationRevision`.

It detects:
- **Header Totals**: Grand total mismatches (WARNING), Subtotal/Tax/Total arithmetic consistency (ERROR).
- **Currency**: Currency mismatches between the PO and the quotation (ERROR).
- **Line Matching**: Unit price discrepancies (WARNING), Quantity discrepancies (WARNING).
- **Structural Integrity**: Missing quotation lines (WARNING), Unmatched PO lines (INFO), and Duplicate line mappings (ERROR).

Blocking errors (`ERROR` severity) mathematically prevent a manager from moving the PO to `VALIDATED`. Warnings and Infos provide critical context to the reviewer.

## Permissions & RBAC
The system utilizes robust RBAC separation:
- `customer_po.create` / `customer_po.update` - For Sales reps to register POs.
- `customer_po.submit` - To push a draft to validation.
- `customer_po.validate` - For Managers to perform compliance reviews and return/reject/validate orders.

All operations enforce strict tenant bounds via the Prisma proxy.
