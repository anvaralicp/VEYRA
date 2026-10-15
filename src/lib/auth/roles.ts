export const SYSTEM_ROLE_TEMPLATES = [
  {
    code: "OWNER",
    name: "Tenant Owner",
    description: "Full administrative access and ownership.",
    // OWNER bypasses all checks natively, but we can assign all permissions for safety/visibility.
    permissions: ["*"]
  },
  {
    code: "ADMIN",
    name: "Administrator",
    description: "General tenant administrator.",
    permissions: [
      "organization.view", "organization.update",
      "business_unit.view", "business_unit.create", "business_unit.update", "business_unit.delete",
      "branch.view", "branch.create", "branch.update", "branch.delete",
      "department.view", "department.create", "department.update", "department.delete",
      "user.view", "user.create", "user.update", "user.deactivate",
      "role.view", "role.create", "role.update", "role.deactivate", "role.assign_permission", "role.assign_user",
      "membership.view", "membership.create", "membership.update", "membership.remove",
      "audit.view", "vendor.view", "vendor.create", "vendor.update", "vendor.activate", "vendor.deactivate",
      "product.view", "product.create", "product.update", "product.deactivate",
      "costing.settings.view", "costing.settings.update",
      "quotation.view", "quotation.create", "quotation.update", "quotation.issue", "quotation.withdraw", "quotation.revise", "quotation.compare",
      "product_vendor.view", "product_vendor.create", "product_vendor.update", "product_vendor.activate", "product_vendor.deactivate", "product_vendor.set_preferred",
      "pricing.view", "pricing.create", "pricing.update", "pricing.activate", "pricing.deactivate", "pricing.calculate",
      "costing.view", "costing.calculate",
      "category.view", "category.create", "category.update", "category.deactivate",
      "manufacturer.view", "manufacturer.create", "manufacturer.update", "manufacturer.deactivate",
      "customer_po.view", "customer_po.create", "customer_po.update", "customer_po.submit", "customer_po.validate", "customer_po.delete"
    ]
  },
  {
    code: "MANAGEMENT",
    name: "Management",
    description: "Management view and reporting access.",
    permissions: [
      "organization.view", "business_unit.view", "branch.view", "department.view",
      "user.view", "role.view", "membership.view", "customer.view", "report.view", "vendor.view", "product.view", "category.view", "manufacturer.view", "product_vendor.view", "pricing.view", "pricing.calculate", "costing.view", "costing.calculate",
      "customer_po.view"
    ]
  },
  {
    code: "SALES",
    name: "Sales",
    description: "Sales and opportunity management.",
    permissions: [
      "customer.view", "customer.create", "customer.update",
      "opportunity.view", "opportunity.create", "opportunity.update",
      "quotation.view", "quotation.create", "quotation.update", "vendor.view", "product.view", "category.view", "manufacturer.view", "product_vendor.view", "pricing.view", "pricing.calculate", "costing.view", "costing.calculate",
      "customer_po.view", "customer_po.create", "customer_po.update", "customer_po.submit"
    ]
  },
  {
    code: "PRESALES",
    name: "Presales",
    description: "Presales and technical support for sales.",
    permissions: [
      "customer.view", "opportunity.view", "vendor.view", "product.view", "category.view", "manufacturer.view", "product_vendor.view", "pricing.view", "pricing.calculate", "costing.view", "costing.calculate"
    ]
  },
  {
    code: "PROCUREMENT",
    name: "Procurement",
    description: "Procurement and purchasing.",
    permissions: [
      "purchase_order.view", "purchase_order.create", "purchase_order.update",
      "product.view",
      "vendor.view", "vendor.create", "vendor.update", "vendor.activate", "vendor.deactivate",
      "product_vendor.view", "product_vendor.create", "product_vendor.update", "product_vendor.activate", "product_vendor.deactivate", "product_vendor.set_preferred",
      "pricing.view", "pricing.create", "pricing.update", "pricing.activate", "pricing.deactivate", "pricing.calculate",
      "costing.view", "costing.calculate",
      "category.view", "manufacturer.view"
    ]
  },
  {
    code: "PROJECT_MANAGER",
    name: "Project Manager",
    description: "Project management.",
    permissions: [
      "customer.view", "project.view", "project.create", "project.update", "project.close",
      "asset.view", "vendor.view", "product.view", "category.view", "manufacturer.view", "product_vendor.view", "pricing.view", "pricing.calculate", "costing.view", "costing.calculate"
    ]
  },
  {
    code: "ENGINEER",
    name: "Engineer",
    description: "Field or support engineer.",
    permissions: [
      "ticket.view", "ticket.update", "ticket.resolve", "asset.view", "vendor.view", "product.view", "category.view", "manufacturer.view", "product_vendor.view", "pricing.view", "pricing.calculate", "costing.view", "costing.calculate"
    ]
  },
  {
    code: "SERVICE_DESK",
    name: "Service Desk",
    description: "Helpdesk and ticketing.",
    permissions: [
      "customer.view",
      "ticket.view", "ticket.create", "ticket.update", "ticket.assign", "ticket.resolve", "ticket.close", "vendor.view", "product.view", "category.view", "manufacturer.view", "product_vendor.view", "pricing.view", "pricing.calculate", "costing.view", "costing.calculate"
    ]
  },
  {
    code: "FINANCE",
    name: "Finance",
    description: "Finance and accounting.",
    permissions: [
      "customer.view", "quotation.view", "quotation.approve", "quotation.return", "quotation.reject", "quotation.approval_settings.view", "purchase_order.view", "contract.view", "report.view", "vendor.view", "product.view", "category.view", "manufacturer.view", "product_vendor.view", "pricing.view", "pricing.calculate", "costing.view", "costing.calculate",
      "customer_po.view", "customer_po.validate"
    ]
  },
  {
    code: "VIEWER",
    name: "Viewer",
    description: "Read-only access.",
    permissions: [
      "organization.view", "customer.view", "vendor.view", "product.view", "category.view", "manufacturer.view", "product_vendor.view", "pricing.view", "pricing.calculate", "costing.view", "costing.calculate",
      "customer_po.view"
    ]
  }
];
