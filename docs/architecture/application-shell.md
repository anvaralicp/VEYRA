# Application Shell Architecture

## Overview
VEYRA's enterprise application shell is inspired by dense, information-oriented SaaS platforms (like ServiceNow) but maintains a clean, modern aesthetic using Tailwind CSS and shadcn/ui.
It serves as the reusable foundation for all future modules (CRM, ITSM, Commercial, etc.).

## Components
- **`AppShell`**: The root layout wrapper handling the Desktop/Mobile responsive grid.
- **`TopBar`**: Contains Tenant Branding, Mobile Navigation toggle, Global Search, Notifications, and User Menu.
- **`Sidebar`**: The primary collapsible left-hand navigation. Grouped by functional modules (HOME, BUSINESS, SERVICE, ANALYTICS, ADMINISTRATION).
- **`MobileNavigation`**: A responsive drawer implementing the same logic as the Sidebar for narrow screens.

## Navigation & RBAC
Navigation is centralized in `src/config/navigation.ts`.
Each route defines an optional `permission`.
The root layout (`src/app/(authenticated)/layout.tsx`) efficiently queries the user's total effective permissions **once** server-side via `getAllUserPermissions()`.
These string keys are passed downward into the Sidebar and Mobile Navigations, avoiding repeated database lookups for visual filtering.

*Note: Visual filtering is UX, not security. Route handlers and Server Actions continue to forcefully validate permissions via `requirePermission(key)`.*

## UI Primitives
Standardized templates ensure modules look unified without rebuilding structures:
1. **`RecordPage`**: Provides Breadcrumbs, Header, Status, Actions, and standard Tabs (Overview, Activities, Related Records, Attachments, Audit).
2. **`ListPage`**: Standardized enterprise data table wrapper with Search, Filter, Columns configuration, Pagination, and Row Actions layout placeholders.
3. **States**: `EmptyState`, `LoadingState`, and `ErrorState` enforce consistent application feedback.

## Branding
Tenant configurations resolve their active `Organization` and display the name natively within the TopBar, replacing any generic platform names, ensuring VEYRA remains a white-labeled B2B platform.
