/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantContext } from "../tenant/context";
import { db } from "../../prisma/db";
import { adaptPrisma7, normalizeWhere } from "./legacy-adapter";

// All 54 models containing a `tenant_id` column in prisma/schema.prisma
const TENANT_MODELS_LIST = [
  "TenantMember",
  "Invitation",
  "Customer",
  "CustomerContact",
  "CustomerSite",
  "BusinessUnit",
  "Branch",
  "Department",
  "AuditLog",
  "Role",
  "RolePermission",
  "MemberRole",
  "Lead",
  "Opportunity",
  "Activity",
  "Requirement",
  "SiteSurvey",
  "Solution",
  "SolutionRevision",
  "BOQ",
  "BOQRevision",
  "BOQLine",
  "ProductCategory",
  "Manufacturer",
  "ProductService",
  "Vendor",
  "ProductVendor",
  "Currency",
  "VendorPrice",
  "CostingSettings",
  "Quotation",
  "QuotationRevision",
  "QuotationLine",
  "QuotationApprovalSettings",
  "QuotationApprovalRequest",
  "QuotationApprovalRecord",
  "CustomerPurchaseOrder",
  "CustomerPurchaseOrderLine",
  "CustomerPurchaseOrderValidation",
  "CustomerPurchaseOrderAttachment",
  "FulfilmentOrder",
  "FulfilmentOrderLine",
  "FulfilmentOrderStatusHistory",
  "SupplierPurchaseOrder",
  "SupplierPurchaseOrderLine",
  "FulfilmentAllocation",
  "SupplierOrderStatusHistory",
  "StockLocation",
  "GoodsReceipt",
  "GoodsReceiptLine",
  "InventoryLedger",
  "StockCount",
  "StockCountLine",
  "InventoryAdjustment",
];

// Set of lowercase model names for fast, case-insensitive lookup
const TENANT_MODELS_SET = new Set(TENANT_MODELS_LIST.map((m) => m.toLowerCase()));

export function isTenantScopedModel(name: string): boolean {
  return TENANT_MODELS_SET.has(name.toLowerCase());
}

/**
 * Sanitizes and enforces tenant_id on nested create objects if any.
 */
export function enforceNestedTenantId(data: any, tenantId: string): any {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data)) {
    return data.map((item) => enforceNestedTenantId(item, tenantId));
  }
  const result: any = { ...data };
  for (const val of Object.values(result)) {
    if (val && typeof val === "object") {
      if (Array.isArray((val as any).create)) {
        (val as any).create = (val as any).create.map((item: any) => ({
          ...enforceNestedTenantId(item, tenantId),
          tenant_id: tenantId,
        }));
      } else if ((val as any).create && typeof (val as any).create === "object") {
        (val as any).create = {
          ...enforceNestedTenantId((val as any).create, tenantId),
          tenant_id: tenantId,
        };
      }
    }
  }
  return result;
}

/**
 * Wraps an adapted model collection with tenant-isolation enforcement.
 */
function wrapTenantModel(adaptedModel: any, modelName: string, tenantId: string): any {
  return new Proxy(adaptedModel, {
    get(modelTarget: any, opName: string) {
      const originalOp = modelTarget[opName];

      if (typeof originalOp !== "function") {
        return originalOp;
      }

      return async (...argsArray: any[]) => {
        const args = argsArray[0] || {};

        // For read/update/delete many & aggregation operations:
        // Automatically normalize where and constrain atomically with tenant_id
        if (
          [
            "findMany",
            "findFirst",
            "findFirstOrThrow",
            "count",
            "updateMany",
            "deleteMany",
            "aggregate",
            "groupBy",
          ].includes(opName)
        ) {
          const normWhere = normalizeWhere(args.where);
          args.where = { ...normWhere, tenant_id: tenantId };
        }

        // For single create operations:
        // Enforce tenant_id on top-level data and nested relations
        else if (opName === "create") {
          const enforcedData = enforceNestedTenantId(args.data || {}, tenantId);
          args.data = { ...enforcedData, tenant_id: tenantId };
        }

        // For bulk create operations
        else if (opName === "createMany") {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((item: any) => ({
              ...item,
              tenant_id: tenantId,
            }));
          } else {
            args.data = { ...args.data, tenant_id: tenantId };
          }
        }

        // For single-record unique reads:
        else if (["findUnique", "findUniqueOrThrow"].includes(opName)) {
          const normWhere = normalizeWhere(args.where);
          args.where = { ...normWhere, tenant_id: tenantId };
        }

        // For single-record mutations (update, delete):
        // Atomically constrain with tenant_id and return a consistent, non-disclosing error
        else if (["update", "delete"].includes(opName)) {
          const normWhere = normalizeWhere(args.where);
          args.where = { ...normWhere, tenant_id: tenantId };

          const res = await originalOp.call(modelTarget, args);
          if (!res) {
            throw new Error(`Record not found in the current tenant.`);
          }
          return res;
        }

        // For upsert operations:
        else if (opName === "upsert") {
          const normWhere = normalizeWhere(args.where);
          args.where = { ...normWhere, tenant_id: tenantId };

          const enforcedCreate = enforceNestedTenantId(args.create || {}, tenantId);
          args.create = { ...enforcedCreate, tenant_id: tenantId };
          args.update = { ...args.update, tenant_id: tenantId };
        }

        return originalOp.call(modelTarget, args);
      };
    },
  });
}

/**
 * Creates a tenant-isolated database proxy around a db client or transaction.
 */
export function createTenantIsolatedProxy(baseTarget: any, tenantId: string): any {
  return new Proxy(baseTarget, {
    get(target: any, prop: string) {
      if (prop === "transaction" || prop === "$transaction") {
        return async (cb: any) => {
          const runTx = target.transaction || target.$transaction;
          return runTx.call(target, async (tx: any) => {
            // Wrap the transaction client with the exact same tenant-isolated proxy
            const isolatedTx = createTenantIsolatedProxy(tx, tenantId);
            return cb(isolatedTx);
          });
        };
      }

      // Self-reference handler for services accessing tdb.tdb
      if (prop === "tdb") {
        return createTenantIsolatedProxy(target, tenantId);
      }

      const modelName = prop as string;
      const originalModel =
        target.orm?.public?.[modelName] ||
        target.orm?.public?.[modelName.charAt(0).toUpperCase() + modelName.slice(1)] ||
        target[modelName] ||
        target[modelName.charAt(0).toLowerCase() + modelName.slice(1)];

      const adaptedModel = adaptPrisma7(originalModel);
      if (!adaptedModel) return undefined;

      if (isTenantScopedModel(modelName)) {
        return wrapTenantModel(adaptedModel, modelName, tenantId);
      }

      return adaptedModel;
    },
  });
}

/**
 * Creates a tenant-isolated database client wrapper.
 * This ensures that any operation on any tenant-owned model automatically applies
 * the authenticated tenant's ID, preventing cross-tenant data access.
 */
export async function getTenantDb() {
  const context = await getTenantContext();
  const tenantId = context.tenantId;

  return createTenantIsolatedProxy(db, tenantId);
}
