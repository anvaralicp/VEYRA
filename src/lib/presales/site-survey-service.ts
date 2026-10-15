/* eslint-disable @typescript-eslint/no-explicit-any */
import { getTenantDb } from "../db/tenant-db";
import { getTenantContext } from "../tenant/context";
import { requirePermission } from "../auth/boundary";
import { logAudit } from "../audit/logger";

async function getPresalesDb() {
  const tdb = await getTenantDb();
  return {
    SiteSurvey: (tdb as any).SiteSurvey || (tdb as any).siteSurvey,
    CustomerSite: (tdb as any).CustomerSite || (tdb as any).customerSite,
    tdb
  };
}

export async function getSiteSurveys(query?: string) {
  await requirePermission("site_survey.view");
  const { SiteSurvey } = await getPresalesDb();
  const where = query ? { survey_number: { contains: query, mode: "insensitive" } } : {};
  return SiteSurvey.findMany({
    where,
    include: { opportunity: { select: { name: true } }, site: { select: { name: true } } },
    orderBy: { created_at: "desc" }
  });
}

export async function getSiteSurveyById(id: string) {
  await requirePermission("site_survey.view");
  const { SiteSurvey } = await getPresalesDb();
  return SiteSurvey.findUnique({
    where: { id },
    include: {
      opportunity: { select: { name: true, opportunity_number: true } },
      customer: { select: { display_name: true } },
      site: { select: { name: true, site_number: true } }
    }
  });
}

export async function createSiteSurvey(data: any) {
  await requirePermission("site_survey.create");
  const { SiteSurvey, CustomerSite } = await getPresalesDb();
  const context = await getTenantContext();

  const site = await CustomerSite.findUnique({ where: { id: data.site_id } });
  if (!site) throw new Error("Customer Site must belong to current tenant");

  const count = await SiteSurvey.count();
  const sNum = `SUR-${String(count + 1).padStart(6, '0')}`;

  const survey = await SiteSurvey.create({
    data: {
      survey_number: sNum,
      opportunity_id: data.opportunity_id,
      requirement_id: data.requirement_id || null,
      customer_id: data.customer_id,
      site_id: data.site_id,
      survey_date: data.survey_date ? new Date(data.survey_date) : null,
      surveyor_id: data.surveyor_id,
      status: data.status || "DRAFT",
      summary: data.summary,
      existing_environment: data.existing_environment,
      requirements: data.requirements,
      constraints: data.constraints,
      observations: data.observations,
      recommendations: data.recommendations,
      created_by: context.userId
    }
  });

  await logAudit("SITE_SURVEY_CREATE", "SiteSurvey", survey.id, { number: sNum });
  return survey;
}

export async function updateSiteSurvey(id: string, data: any) {
  await requirePermission("site_survey.update");
  const { SiteSurvey } = await getPresalesDb();
  const context = await getTenantContext();

  const old = await SiteSurvey.findUnique({ where: { id } });
  if (!old) throw new Error("Not found");

  const updateData: any = {
    survey_date: data.survey_date ? new Date(data.survey_date) : null,
    surveyor_id: data.surveyor_id,
    summary: data.summary,
    existing_environment: data.existing_environment,
    requirements: data.requirements,
    constraints: data.constraints,
    observations: data.observations,
    recommendations: data.recommendations,
    updated_by: context.userId
  };

  if (data.status && data.status !== old.status) {
    if (data.status === "COMPLETED") {
      await requirePermission("site_survey.complete");
      await logAudit("SITE_SURVEY_COMPLETE", "SiteSurvey", id, null);
    } else {
      await logAudit("SITE_SURVEY_STATUS_CHANGE", "SiteSurvey", id, { from: old.status, to: data.status });
    }
    updateData.status = data.status;
  }

  const survey = await SiteSurvey.update({ where: { id }, data: updateData });
  await logAudit("SITE_SURVEY_UPDATE", "SiteSurvey", id, null);
  return survey;
}
