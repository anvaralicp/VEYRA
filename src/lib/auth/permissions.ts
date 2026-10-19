export const SYSTEM_PERMISSIONS = [
  // Organization
  { key: "organization.view", resource: "organization", action: "view", description: "View organization details" },
  { key: "organization.update", resource: "organization", action: "update", description: "Update organization details" },

  // Business Units
  { key: "business_unit.view", resource: "business_unit", action: "view", description: "View business units" },
  { key: "business_unit.create", resource: "business_unit", action: "create", description: "Create business units" },
  { key: "business_unit.update", resource: "business_unit", action: "update", description: "Update business units" },
  { key: "business_unit.delete", resource: "business_unit", action: "delete", description: "Delete business units" },

  // Branches
  { key: "branch.view", resource: "branch", action: "view", description: "View branches" },
  { key: "branch.create", resource: "branch", action: "create", description: "Create branches" },
  { key: "branch.update", resource: "branch", action: "update", description: "Update branches" },
  { key: "branch.delete", resource: "branch", action: "delete", description: "Delete branches" },

  // Departments
  { key: "department.view", resource: "department", action: "view", description: "View departments" },
  { key: "department.create", resource: "department", action: "create", description: "Create departments" },
  { key: "department.update", resource: "department", action: "update", description: "Update departments" },
  { key: "department.delete", resource: "department", action: "delete", description: "Delete departments" },

  // Users
  { key: "user.view", resource: "user", action: "view", description: "View users" },
  { key: "user.create", resource: "user", action: "create", description: "Create users" },
  { key: "user.update", resource: "user", action: "update", description: "Update users" },
  { key: "user.deactivate", resource: "user", action: "deactivate", description: "Deactivate users" },

  // Roles
  { key: "role.view", resource: "role", action: "view", description: "View roles" },
  { key: "role.create", resource: "role", action: "create", description: "Create roles" },
  { key: "role.update", resource: "role", action: "update", description: "Update roles" },
  { key: "role.deactivate", resource: "role", action: "deactivate", description: "Deactivate roles" },
  { key: "role.assign_permission", resource: "role", action: "assign_permission", description: "Assign permissions to roles" },
  { key: "role.assign_user", resource: "role", action: "assign_user", description: "Assign roles to users" },

  // Memberships
  { key: "membership.view", resource: "membership", action: "view", description: "View tenant memberships" },
  { key: "membership.create", resource: "membership", action: "create", description: "Create tenant memberships" },
  { key: "membership.update", resource: "membership", action: "update", description: "Update tenant memberships" },
  { key: "membership.remove", resource: "membership", action: "remove", description: "Remove tenant memberships" },

  // Audit
  { key: "audit.view", resource: "audit", action: "view", description: "View audit logs" },

  // Customers
  { key: "customer.view", resource: "customer", action: "view", description: "View customers" },
  { key: "customer.create", resource: "customer", action: "create", description: "Create customers" },
  { key: "customer.update", resource: "customer", action: "update", description: "Update customers" },
  { key: "customer.delete", resource: "customer", action: "delete", description: "Delete customers" },

  // Contacts
  { key: "contact.view", resource: "contact", action: "view", description: "View customer contacts" },
  { key: "contact.create", resource: "contact", action: "create", description: "Create customer contacts" },
  { key: "contact.update", resource: "contact", action: "update", description: "Update customer contacts" },
  { key: "contact.delete", resource: "contact", action: "delete", description: "Delete customer contacts" },

  // Sites
  { key: "site.view", resource: "site", action: "view", description: "View customer sites" },
  { key: "site.create", resource: "site", action: "create", description: "Create customer sites" },
  { key: "site.update", resource: "site", action: "update", description: "Update customer sites" },
  { key: "site.delete", resource: "site", action: "delete", description: "Delete customer sites" },

  // Leads
  { key: "lead.view", resource: "lead", action: "view", description: "View leads" },
  { key: "lead.create", resource: "lead", action: "create", description: "Create leads" },
  { key: "lead.update", resource: "lead", action: "update", description: "Update leads" },
  { key: "lead.delete", resource: "lead", action: "delete", description: "Delete leads" },
  { key: "lead.convert", resource: "lead", action: "convert", description: "Convert leads" },

  // Opportunities
  { key: "opportunity.view", resource: "opportunity", action: "view", description: "View opportunities" },
  { key: "opportunity.create", resource: "opportunity", action: "create", description: "Create opportunities" },
  { key: "opportunity.update", resource: "opportunity", action: "update", description: "Update opportunities" },
  { key: "opportunity.delete", resource: "opportunity", action: "delete", description: "Delete opportunities" },
  { key: "opportunity.close", resource: "opportunity", action: "close", description: "Close opportunities" },

  // Activities
  { key: "activity.view", resource: "activity", action: "view", description: "View activities" },
  { key: "activity.create", resource: "activity", action: "create", description: "Create activities" },
  { key: "activity.update", resource: "activity", action: "update", description: "Update activities" },
  { key: "activity.delete", resource: "activity", action: "delete", description: "Delete activities" },

  // Presales
  { key: "requirement.view", resource: "requirement", action: "view", description: "View requirements" },
  { key: "requirement.create", resource: "requirement", action: "create", description: "Create requirements" },
  { key: "requirement.update", resource: "requirement", action: "update", description: "Update requirements" },
  { key: "requirement.approve", resource: "requirement", action: "approve", description: "Approve requirements" },

  { key: "site_survey.view", resource: "site_survey", action: "view", description: "View site surveys" },
  { key: "site_survey.create", resource: "site_survey", action: "create", description: "Create site surveys" },
  { key: "site_survey.update", resource: "site_survey", action: "update", description: "Update site surveys" },
  { key: "site_survey.complete", resource: "site_survey", action: "complete", description: "Complete site surveys" },

  { key: "solution.view", resource: "solution", action: "view", description: "View solutions" },
  { key: "solution.create", resource: "solution", action: "create", description: "Create solutions" },
  { key: "solution.update", resource: "solution", action: "update", description: "Update solutions" },
  { key: "solution.approve", resource: "solution", action: "approve", description: "Approve solutions" },

  { key: "boq.view", resource: "boq", action: "view", description: "View BOQs" },
  { key: "boq.create", resource: "boq", action: "create", description: "Create BOQs" },
  { key: "boq.update", resource: "boq", action: "update", description: "Update BOQs" },
  { key: "boq.submit", resource: "boq", action: "submit", description: "Submit BOQs" },
  { key: "boq.approve", resource: "boq", action: "approve", description: "Approve BOQs" },
  { key: "boq.reject", resource: "boq", action: "reject", description: "Reject BOQs" },

  // Commercial Foundation
  { key: "product.view", resource: "product", action: "view", description: "View products/services" },
  { key: "product.create", resource: "product", action: "create", description: "Create products/services" },
  { key: "product.update", resource: "product", action: "update", description: "Update products/services" },
  { key: "product.deactivate", resource: "product", action: "deactivate", description: "Deactivate products/services" },

  { key: "category.view", resource: "category", action: "view", description: "View categories" },
  { key: "category.create", resource: "category", action: "create", description: "Create categories" },
  { key: "category.update", resource: "category", action: "update", description: "Update categories" },
  { key: "category.deactivate", resource: "category", action: "deactivate", description: "Deactivate categories" },

  { key: "manufacturer.view", resource: "manufacturer", action: "view", description: "View manufacturers" },
  { key: "manufacturer.create", resource: "manufacturer", action: "create", description: "Create manufacturers" },
  { key: "manufacturer.update", resource: "manufacturer", action: "update", description: "Update manufacturers" },
  { key: "manufacturer.deactivate", resource: "manufacturer", action: "deactivate", description: "Deactivate manufacturers" },

  { key: "vendor.view", resource: "vendor", action: "view", description: "View vendors" },
  { key: "vendor.create", resource: "vendor", action: "create", description: "Create vendors" },
  { key: "vendor.update", resource: "vendor", action: "update", description: "Update vendors" },
  { key: "vendor.activate", resource: "vendor", action: "activate", description: "Activate vendors" },
  { key: "vendor.deactivate", resource: "vendor", action: "deactivate", description: "Deactivate vendors" },

  { key: "product_vendor.view", resource: "product_vendor", action: "view", description: "View product vendor mappings" },
  { key: "product_vendor.create", resource: "product_vendor", action: "create", description: "Create product vendor mappings" },
  { key: "product_vendor.update", resource: "product_vendor", action: "update", description: "Update product vendor mappings" },
  { key: "product_vendor.activate", resource: "product_vendor", action: "activate", description: "Activate product vendor mappings" },
  { key: "product_vendor.deactivate", resource: "product_vendor", action: "deactivate", description: "Deactivate product vendor mappings" },
  { key: "product_vendor.set_preferred", resource: "product_vendor", action: "set_preferred", description: "Set preferred vendor" },

  { key: "pricing.view", resource: "pricing", action: "view", description: "View pricing" },
  { key: "pricing.create", resource: "pricing", action: "create", description: "Create pricing" },
  { key: "pricing.update", resource: "pricing", action: "update", description: "Update pricing" },
  { key: "pricing.activate", resource: "pricing", action: "activate", description: "Activate pricing" },
  { key: "pricing.deactivate", resource: "pricing", action: "deactivate", description: "Deactivate pricing" },
  { key: "pricing.calculate", resource: "pricing", action: "calculate", description: "Calculate cost" },

  { key: "costing.view", resource: "costing", action: "view", description: "View costing features" },
  { key: "costing.calculate", resource: "costing", action: "calculate", description: "Calculate commercial cost" },
  { key: "costing.settings.view", resource: "costing_settings", action: "view", description: "View costing settings" },
  { key: "costing.settings.update", resource: "costing_settings", action: "update", description: "Update costing settings" },

  { key: "quotation.view", resource: "quotation", action: "view", description: "View quotations" },
  { key: "quotation.create", resource: "quotation", action: "create", description: "Create quotations" },
  { key: "quotation.update", resource: "quotation", action: "update", description: "Update quotation drafts" },
  { key: "quotation.issue", resource: "quotation", action: "issue", description: "Issue quotations to customers" },
  { key: "quotation.withdraw", resource: "quotation", action: "withdraw", description: "Withdraw issued quotations" },
  { key: "quotation.revise", resource: "quotation", action: "revise", description: "Create quotation revisions" },
  { key: "quotation.compare", resource: "quotation", action: "compare", description: "Compare quotation revisions" },
  { key: "quotation.submit_for_approval", resource: "quotation", action: "submit_for_approval", description: "Submit quotation for approval" },
  { key: "quotation.approve", resource: "quotation", action: "approve", description: "Approve quotations" },
  { key: "quotation.return", resource: "quotation", action: "return", description: "Return quotations" },
  { key: "quotation.reject", resource: "quotation", action: "reject", description: "Reject quotations" },
  { key: "quotation.approval_settings.view", resource: "quotation", action: "view_approval_settings", description: "View quotation approval settings" },
  { key: "quotation.approval_settings.update", resource: "quotation", action: "update_approval_settings", description: "Update quotation approval settings" },


  // Customer Purchase Orders
  { key: "customer_po.view", resource: "customer_po", action: "view", description: "View customer purchase orders" },
  { key: "customer_po.create", resource: "customer_po", action: "create", description: "Create customer purchase orders" },
  { key: "customer_po.update", resource: "customer_po", action: "update", description: "Update customer purchase orders" },
  { key: "customer_po.submit", resource: "customer_po", action: "submit", description: "Submit customer purchase orders" },
  { key: "customer_po.validate", resource: "customer_po", action: "validate", description: "Validate/review customer purchase orders" },
  { key: "customer_po.delete", resource: "customer_po", action: "delete", description: "Delete customer purchase orders" },

  // Future Module Placeholders
  { key: "purchase_order.view", resource: "purchase_order", action: "view", description: "View purchase orders" },
  { key: "purchase_order.create", resource: "purchase_order", action: "create", description: "Create purchase orders" },
  { key: "purchase_order.update", resource: "purchase_order", action: "update", description: "Update purchase orders" },
  { key: "purchase_order.approve", resource: "purchase_order", action: "approve", description: "Approve purchase orders" },

  { key: "project.view", resource: "project", action: "view", description: "View projects" },
  { key: "project.create", resource: "project", action: "create", description: "Create projects" },
  { key: "project.update", resource: "project", action: "update", description: "Update projects" },
  { key: "project.close", resource: "project", action: "close", description: "Close projects" },

  { key: "asset.view", resource: "asset", action: "view", description: "View assets" },
  { key: "asset.create", resource: "asset", action: "create", description: "Create assets" },
  { key: "asset.update", resource: "asset", action: "update", description: "Update assets" },

  { key: "ticket.view", resource: "ticket", action: "view", description: "View tickets" },
  { key: "ticket.create", resource: "ticket", action: "create", description: "Create tickets" },
  { key: "ticket.update", resource: "ticket", action: "update", description: "Update tickets" },
  { key: "ticket.assign", resource: "ticket", action: "assign", description: "Assign tickets" },
  { key: "ticket.resolve", resource: "ticket", action: "resolve", description: "Resolve tickets" },
  { key: "ticket.close", resource: "ticket", action: "close", description: "Close tickets" },

  { key: "contract.view", resource: "contract", action: "view", description: "View contracts" },
  { key: "contract.create", resource: "contract", action: "create", description: "Create contracts" },
  { key: "contract.update", resource: "contract", action: "update", description: "Update contracts" },
  { key: "contract.renew", resource: "contract", action: "renew", description: "Renew contracts" },

  { key: "report.view", resource: "report", action: "view", description: "View reports" },

  // Fulfilment
  { key: "fulfilment.view", resource: "fulfilment", action: "view", description: "View fulfilment orders" },
  { key: "fulfilment.create", resource: "fulfilment", action: "create", description: "Create fulfilment orders" },
  { key: "fulfilment.update", resource: "fulfilment", action: "update", description: "Update fulfilment orders" },
  { key: "fulfilment.plan", resource: "fulfilment", action: "plan", description: "Plan fulfilment orders" },
  { key: "fulfilment.mark_ready", resource: "fulfilment", action: "mark_ready", description: "Mark fulfilment orders ready" },
  { key: "fulfilment.hold", resource: "fulfilment", action: "hold", description: "Hold fulfilment orders" },
  { key: "fulfilment.cancel", resource: "fulfilment", action: "cancel", description: "Cancel fulfilment orders" },


  // Procurement
  { key: "procurement.view", resource: "procurement", action: "view", description: "View supplier purchase orders" },
  { key: "procurement.create", resource: "procurement", action: "create", description: "Create supplier purchase orders" },
  { key: "procurement.update", resource: "procurement", action: "update", description: "Update supplier purchase orders" },
  { key: "procurement.submit", resource: "procurement", action: "submit", description: "Submit supplier purchase orders for approval" },
  { key: "procurement.approve", resource: "procurement", action: "approve", description: "Approve supplier purchase orders" },
  { key: "procurement.issue", resource: "procurement", action: "issue", description: "Issue supplier purchase orders" },
  { key: "procurement.acknowledge", resource: "procurement", action: "acknowledge", description: "Acknowledge supplier purchase orders" },
  { key: "procurement.hold", resource: "procurement", action: "hold", description: "Hold supplier purchase orders" },
  { key: "procurement.cancel", resource: "procurement", action: "cancel", description: "Cancel supplier purchase orders" },
  { key: "procurement.close", resource: "procurement", action: "close", description: "Close supplier purchase orders" },


  // Inventory
  { key: "inventory.view", resource: "inventory", action: "view", description: "View inventory balances" },
  { key: "inventory.location.view", resource: "inventory_location", action: "view", description: "View stock locations" },
  { key: "inventory.location.create", resource: "inventory_location", action: "create", description: "Create stock locations" },
  { key: "inventory.location.update", resource: "inventory_location", action: "update", description: "Update stock locations" },
  { key: "goods_receipt.view", resource: "goods_receipt", action: "view", description: "View goods receipts" },
  { key: "goods_receipt.create", resource: "goods_receipt", action: "create", description: "Create goods receipts" },
  { key: "goods_receipt.update", resource: "goods_receipt", action: "update", description: "Update goods receipts" },
  { key: "goods_receipt.post", resource: "goods_receipt", action: "post", description: "Post goods receipts" },

  // Platform Administration (Strictly isolated from tenant membership and business data)
  { key: "platform.dashboard.view", resource: "platform", action: "view_dashboard", description: "View platform overview dashboard and aggregate metadata" },
  { key: "platform.tenant.view", resource: "platform_tenant", action: "view", description: "View tenant directory and administrative metadata" },
  { key: "platform.tenant.suspend", resource: "platform_tenant", action: "suspend", description: "Suspend tenant account and access" },
  { key: "platform.tenant.reactivate", resource: "platform_tenant", action: "reactivate", description: "Reactivate suspended tenant account" },
  { key: "platform.tenant.invite_admin", resource: "platform_tenant", action: "invite_admin", description: "Invite or manage tenant administrators" },
  { key: "platform.audit.view", resource: "platform_audit", action: "view", description: "View platform administrative audit trail" },
  { key: "platform.sales.view", resource: "platform_sales", action: "view", description: "View inbound sales enquiries and platform sales pipeline" },
  { key: "platform.sales.manage", resource: "platform_sales", action: "manage", description: "Manage platform sales enquiry status, qualification and conversion" },
  { key: "platform.tenant.restrict", resource: "platform_tenant", action: "restrict", description: "Apply, modify, or release tenant administrative restrictions" },
  { key: "platform.subscription.manage", resource: "platform_subscription", action: "manage", description: "Manage tenant subscription plans, pricing tier overrides, and trial extensions" },
  { key: "platform.financials.view", resource: "platform_financials", action: "view", description: "View platform financial KPIs, plan distributions and projected revenue" },
];

export const PLATFORM_PERMISSIONS = SYSTEM_PERMISSIONS.filter((p) => p.key.startsWith("platform."));
export const TENANT_PERMISSIONS = SYSTEM_PERMISSIONS.filter((p) => !p.key.startsWith("platform."));
