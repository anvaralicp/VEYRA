"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as RequirementService from "../../../lib/presales/requirement-service";
import * as SiteSurveyService from "../../../lib/presales/site-survey-service";
import * as SolutionService from "../../../lib/presales/solution-service";
import * as BOQService from "../../../lib/presales/boq-service";

export async function createRequirementAction(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const req = await RequirementService.createRequirement(data);
  revalidatePath("/presales/requirements");
  redirect(`/presales/requirements/${req.id}`);
}

export async function createSiteSurveyAction(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const sur = await SiteSurveyService.createSiteSurvey(data);
  revalidatePath("/presales/site-surveys");
  redirect(`/presales/site-surveys/${sur.id}`);
}

export async function createSolutionAction(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const sol = await SolutionService.createSolution(data);
  revalidatePath("/presales/solutions");
  redirect(`/presales/solutions/${sol.id}`);
}

export async function createBOQAction(formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  const boq = await BOQService.createBOQ(data);
  revalidatePath("/presales/boqs");
  redirect(`/presales/boqs/${boq.id}`);
}

export async function addBOQLineAction(boqId: string, revisionId: string, formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  await BOQService.addBOQLine(boqId, revisionId, data);
  revalidatePath(`/presales/boqs/${boqId}`);
}

export async function submitBOQRevisionAction(boqId: string, revisionId: string) {
  await BOQService.submitBOQRevision(boqId, revisionId);
  revalidatePath(`/presales/boqs/${boqId}`);
}

export async function approveBOQRevisionAction(boqId: string, revisionId: string) {
  await BOQService.approveBOQRevision(boqId, revisionId);
  revalidatePath(`/presales/boqs/${boqId}`);
}

export async function rejectBOQRevisionAction(boqId: string, revisionId: string) {
  await BOQService.rejectBOQRevision(boqId, revisionId);
  revalidatePath(`/presales/boqs/${boqId}`);
}

export async function newBOQRevisionAction(boqId: string) {
  await BOQService.createBOQRevision(boqId);
  revalidatePath(`/presales/boqs/${boqId}`);
}

export async function newSolutionRevisionAction(solId: string, formData: FormData) {
  const data = Object.fromEntries(formData.entries());
  await SolutionService.createSolutionRevision(solId, data);
  revalidatePath(`/presales/solutions/${solId}`);
}
