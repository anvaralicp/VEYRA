# Inventory and Goods Receipts

## Overview
The VEYRA Inventory and Goods Receipt module handles the translation of commercial procurement (Supplier POs) into tangible, physical stock.

## Goods Receipt Lifecycle
- **DRAFT**: Created against an ISSUED or ACKNOWLEDGED Supplier PO. During this phase, users enter lines reflecting the quantities physically received, explicitly dividing them into accepted_quantity and
rejected_quantity.
- **POSTED**: The document becomes immutable. Accepted quantities on stockable products are recorded to the InventoryLedger as a stock-increasing receipt. Rejected quantities are audited but do not increase stock.

## Over-receipt Policy
The module enforces a strict upper limit against the Supplier PO ordered quantities.
Before posting, the system recalculates the total
received_quantity for every receipt line belonging to that PO. If the combined total across all posted and currently posting receipts exceeds the originally ordered quantity, the transaction is rejected.

## Receiving Locations
StockLocation records manage where inventory lands. Locations are tied to the tenant, and optionally connected to physical Branch records. An inactive location cannot receive goods.

## Product Eligibility
Products feature an is_stockable flag. Only products explicitly marked as stockable will generate an InventoryLedger event during posting. Non-stockable items (e.g. digital services, SaaS subscriptions, one-time fees) can be received commercially via the Goods Receipt for Accounts Payable continuity, but they do not artificially inflate physical stock counts.

## Concurrency & Immutable Ledger
All stock updates pass through an InventoryLedger. VEYRA does not directly update a mutable stock table for receipts; it securely appends movement entries tied to the specific transaction. Stock balances are mathematically aggregated in real-time, providing flawless historical replayability.
