import { getTenantContext } from "../tenant/context";
import { getTenantDb } from "../db/tenant-db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function logAudit(action: string, entity: string, entityId?: string, details?: any) {
  try {
    const context = await getTenantContext();
    const db = await getTenantDb();

    await db.AuditLog.create({
      data: {
        action,
        entity,
        entity_id: entityId,
        user_id: context.userId,
        details: details ? JSON.stringify(details) : null
      }
    });
  } catch (error) {
    console.error("Audit log failed:", error);
    // Do not throw; audit logging shouldn't crash operations, but in strict environments it might.
  }
}
