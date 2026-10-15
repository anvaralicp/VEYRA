# Fulfilment Orders

## Overview
The Fulfilment Order Management module converts validated Customer Purchase Orders into internal operational commitments.

While a Customer PO tracks external, customer-supplied business intent, the Fulfilment Order acts as the internal operational root for downstream execution (e.g., Procurement, Inventory, Service Delivery, and Projects).

## Distinctions
- **Customer PO**: A legally binding record of intent from a customer (external).
- **Fulfilment Order**: The internal operational parent that translates the Customer PO into actionable internal records.
- **Supplier Purchase Order** (Future): Internal orders sent to vendors or suppliers for procurement, derived from the Fulfilment Order.

## Core Lifecycle
The fulfilment order follows a distinct operational lifecycle:
1. **OPEN**: Order has been created from a validated customer PO but requires planning.
2. **PLANNING**: Internal planning is actively in progress.
3. **READY**: The planning checks are complete and the order is handed off for execution (e.g., procurement).
4. **ON_HOLD**: Work has been intentionally paused.
5. **CANCELLED**: The fulfilment order has been cancelled by an authorized actor.

## Conversion Rules
A Fulfilment Order can only be created from a Customer PO that meets these rules:
- Belongs to the authenticated tenant.
- Is strictly in the `VALIDATED` state.

**Idempotency:** A strict `1:1` mapping is enforced by a database uniqueness constraint. Duplicate conversion requests are blocked securely.

## Snapshot and Quantity Integrity
During conversion:
- Lines are deeply copied from the customer PO into `FulfilmentOrderLine`.
- Accepted quantities, item codes, and item descriptions are snapshotted.
- Quotation revisions are explicitly referenced but never modified.
- Current product catalogues or vendor pricing lists are ignored to preserve historical fidelity.

## Readiness and Planning
Authorized users can modify operational targets:
- **Target Date**: Planned delivery or completion date.
- **Responsible Person**: Operational owner.
- **Customer Site**: Required destination for physical assets.
- **Planned Quantity**: Can be adjusted by planners if execution is phased (e.g., split deliveries), though the core constraint validation checks ensure it remains > 0.

To transition to `READY`, strict constraints are programmatically enforced (e.g., a target date and responsible owner must exist).

## Permissions
The RBAC implementation supports standard lifecycle actions:
- `fulfilment.view`
- `fulfilment.create`
- `fulfilment.update`
- `fulfilment.plan`
- `fulfilment.mark_ready`
- `fulfilment.hold`
- `fulfilment.cancel`
