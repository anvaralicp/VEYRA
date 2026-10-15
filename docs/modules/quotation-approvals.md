# Quotation Approvals

## Overview

The Quotation Approval module implements a robust, tenant-isolated workflow that governs when and how commercial quotations are approved before they can be issued to customers.

It is designed with strict separation of duties, dynamic policy evaluation, and financial gating based on configurable thresholds.

## Architecture

The module extends the Quotation foundation with three primary entities:

- **QuotationApprovalSettings**: Tenant-scoped configuration that determines if approvals are required globally, defines the strict margin thresholds, and sets value-based thresholds.
- **QuotationApprovalRequest**: A stateful submission record representing a quotation revision currently undergoing (or having undergone) the approval workflow. It captures a snapshot of the evaluation criteria (e.g., total value, calculated margin) at the moment of submission.
- **QuotationApprovalRecord**: An immutable, chronological ledger of decisions made against a `QuotationApprovalRequest`. It ensures a verifiable audit trail of who approved, rejected, or returned a quotation and their provided rationale.

## Workflow Rules

1. **Policy Evaluation**: The `evaluateQuotationPolicy` function dynamically inspects a quotation revision against the tenant's active settings. Approval is required if:
   - The quotation's grand total equals or exceeds the `value_threshold`.
   - The quotation's calculated aggregate margin falls strictly below the `minimum_margin` percentage.
2. **Submission (`submitQuotationForApproval`)**: When a user submits a revision, a new `QuotationApprovalRequest` is generated. The revision's `approval_status` becomes `PENDING`.
3. **Locking Mechanism**: While a revision is `PENDING`, all commercial mutations (adding lines, editing prices, removing items) are strictly blocked.
4. **Separation of Duties**: The system enforces that the user who initiated the approval request cannot be the same user who decides on the approval.
5. **Decisions (`decideQuotationApproval`)**:
   - `APPROVED`: The revision is unlocked for issuance.
   - `RETURNED`: The revision is unlocked for editing. The sales representative can modify the draft and must resubmit it later.
   - `REJECTED`: The revision is permanently locked. It can never be issued or resubmitted. A new revision must be branched to continue negotiations.
6. **Issuance Gate**: The `issueQuotation` service explicitly blocks issuance if the current policy mandates an approval but the revision lacks an `APPROVED` status.

## UI Integration

- **Approvals Queue (`/commercial/quotations/approvals`)**: A centralized dashboard for managers to review pending requests. It surfaces margin and value metrics to accelerate decision-making.
- **Approval Settings (`/commercial/quotations/approval-settings`)**: An administrative interface to toggle the workflow and define financial thresholds per tenant.

## Security & Tenancy

All tables and queries enforce `tenant_id` isolation via the Prisma ORM proxy. RBAC intercepts ensure that only users with `quotation_approval.manage` can make decisions, while users with `quotation_approval.manage_settings` can alter thresholds.
