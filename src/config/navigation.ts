export interface NavigationItem {
  label: string;
  route: string;
  icon: string;
  section: string;
  permission?: string;
  feature?: string;
  order: number;
}

export const NAVIGATION_CONFIG: NavigationItem[] = [
  // HOME
  { label: "Dashboard", route: "/dashboard", icon: "layout-dashboard", section: "HOME", order: 10 },
  { label: "My Work", route: "/my-work", icon: "briefcase", section: "HOME", order: 20 },

  // PRESALES
  { label: "Requirements", route: "/presales/requirements", icon: "clipboard-list", section: "PRESALES", permission: "requirement.view", feature: "presales", order: 10 },
  { label: "Site Surveys", route: "/presales/site-surveys", icon: "map", section: "PRESALES", permission: "site_survey.view", feature: "presales", order: 20 },
  { label: "Solutions", route: "/presales/solutions", icon: "cpu", section: "PRESALES", permission: "solution.view", feature: "presales", order: 30 },
  { label: "BOQs", route: "/presales/boqs", icon: "list", section: "PRESALES", permission: "boq.view", feature: "presales", order: 40 },

  // BUSINESS
  { label: "Leads", route: "/crm/leads", icon: "user-plus", section: "BUSINESS", permission: "lead.view", feature: "crm", order: 5 },
  { label: "Customers", route: "/crm/customers", icon: "users", section: "BUSINESS", permission: "customer.view", feature: "crm", order: 10 },
  { label: "Opportunities", route: "/crm/opportunities", icon: "target", section: "BUSINESS", permission: "opportunity.view", feature: "crm", order: 15 },
  { label: "Sales", route: "/sales", icon: "trending-up", section: "BUSINESS", permission: "quotation.view", feature: "sales", order: 30 },

  // COMMERCIAL
  { label: "Quotations", route: "/commercial/quotations", icon: "file-text", section: "COMMERCIAL", permission: "quotation.view", feature: "commercial", order: 2 },
  { label: "Customer POs", route: "/commercial/customer-pos", icon: "file-check", section: "COMMERCIAL", permission: "customer_po.view", feature: "commercial", order: 3 },
  { label: "Vendors", route: "/commercial/vendors", icon: "truck", section: "COMMERCIAL", permission: "vendor.view", feature: "commercial", order: 5 },
  { label: "Products & Services", route: "/commercial/products", icon: "package", section: "COMMERCIAL", permission: "product.view", feature: "commercial", order: 10 },
  { label: "Categories", route: "/commercial/categories", icon: "folder-tree", section: "COMMERCIAL", permission: "category.view", feature: "commercial", order: 20 },
  { label: "Manufacturers", route: "/commercial/manufacturers", icon: "building-2", section: "COMMERCIAL", permission: "manufacturer.view", feature: "commercial", order: 30 },

  { label: "Procurement", route: "/procurement", icon: "shopping-cart", section: "BUSINESS", permission: "purchase_order.view", feature: "procurement", order: 50 },
  { label: "Inventory", route: "/inventory", icon: "package", section: "BUSINESS", feature: "inventory", order: 60 },
  { label: "Projects", route: "/projects", icon: "kanban", section: "BUSINESS", permission: "project.view", feature: "projects", order: 70 },

  // SERVICE
  { label: "Service Desk", route: "/service-desk", icon: "headset", section: "SERVICE", permission: "ticket.view", feature: "service", order: 10 },
  { label: "Field Service", route: "/field-service", icon: "truck", section: "SERVICE", feature: "field_service", order: 20 },
  { label: "Assets", route: "/assets", icon: "server", section: "SERVICE", permission: "asset.view", feature: "assets", order: 30 },
  { label: "Contracts", route: "/contracts", icon: "file-signature", section: "SERVICE", permission: "contract.view", feature: "contracts", order: 40 },
  { label: "Renewals", route: "/renewals", icon: "repeat", section: "SERVICE", permission: "contract.renew", feature: "renewals", order: 50 },

  // ANALYTICS
  { label: "Reports", route: "/reports", icon: "bar-chart", section: "ANALYTICS", permission: "report.view", feature: "reports", order: 10 },
  { label: "Dashboards", route: "/dashboards", icon: "pie-chart", section: "ANALYTICS", feature: "dashboards", order: 20 },

  // ADMINISTRATION
  { label: "Organization", route: "/admin", icon: "building", section: "ADMINISTRATION", permission: "organization.view", feature: "admin", order: 10 },
  { label: "Users", route: "/admin/users", icon: "users-cog", section: "ADMINISTRATION", permission: "user.view", feature: "admin", order: 20 },
  { label: "Roles & Permissions", route: "/admin/roles", icon: "shield", section: "ADMINISTRATION", permission: "role.view", feature: "admin", order: 30 },
  { label: "Configuration", route: "/admin/configuration", icon: "settings", section: "ADMINISTRATION", permission: "organization.view", feature: "admin", order: 40 },
];

export const NAVIGATION_SECTIONS = [
  { id: "HOME", label: "Home" },
  { id: "BUSINESS", label: "Business" },
  { id: "COMMERCIAL", label: "Commercial" },
  { id: "SERVICE", label: "Service" },
  { id: "ANALYTICS", label: "Analytics" },
  { id: "ADMINISTRATION", label: "Administration" },
];
