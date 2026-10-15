/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";

async function getCrmDb() {
  const tdb = await getTenantDb();
  return {
    Activity: tdb.Activity || tdb.activity,
    tdb
  };
}

export async function createActivity(data: any) {
  await requirePermission("activity.create");
  const { Activity } = await getCrmDb();
  const context = await getTenantContext();

  const activity = await Activity.create({
    data: {
      activity_type: data.activity_type || "NOTE",
      subject: data.subject,
      description: data.description,
      lead_id: data.lead_id,
      opportunity_id: data.opportunity_id,
      customer_id: data.customer_id,
      contact_id: data.contact_id,
      created_by: context.userId
    }
  });

  await logAudit("ACTIVITY_CREATE", "Activity", activity.id, { type: activity.activity_type });
  return activity;
}

export async function getActivities(where: any) {
  await requirePermission("activity.view");
  const { Activity } = await getCrmDb();
  return Activity.findMany({
    where,
    orderBy: { created_at: 'desc' }
  });
}
