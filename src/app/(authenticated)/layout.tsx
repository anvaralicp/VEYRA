/* eslint-disable @typescript-eslint/no-explicit-any */
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "../../components/layout/AppShell";
import { requireAuthenticatedUser } from "../../lib/auth/boundary";
import { getAllUserPermissions } from "../../lib/auth/boundary";
import { getTenantContext } from "../../lib/tenant/context";
import { getModel } from "../../lib/db/legacy-adapter";
import { db } from "../../prisma/db";

export const instant = false;

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  let sessionUser;
  try {
    sessionUser = await requireAuthenticatedUser();
  } catch (e: any) {
    if (e?.message?.includes("NEXT_REDIRECT") || e?.digest?.includes("NEXT_REDIRECT")) throw e;
    redirect("/login");
  }

  let context;
  try {
    context = await getTenantContext();
  } catch (e: any) {
    if (e?.message?.includes("NEXT_REDIRECT") || e?.digest?.includes("NEXT_REDIRECT")) throw e;
    redirect("/select-tenant");
  }

  let tenant = null;
  try {
    const Tenant = getModel(db, "Tenant");
    tenant = Tenant
      ? await Tenant.findUnique({
          where: { id: context.tenantId },
          select: { id: true, name: true, slug: true },
        })
      : null;
  } catch (err: any) {
    console.warn("[AuthenticatedLayout] Could not load tenant record:", err?.message);
    tenant = null;
  }

  const User = getModel(db, "User");
  const user = User
    ? await User.findUnique({
        where: { id: sessionUser.userId },
      })
    : null;

  const orgName = tenant?.name || "My Organization";
  const userName = user?.name || sessionUser.email.split('@')[0];

  // Resolve permissions ONCE for the shell
  const permissions = await getAllUserPermissions();

  return (
    <AppShell
      user={{ name: userName, email: sessionUser.email }}
      organization={{ name: orgName }}
      permissions={permissions}
    >
      {children}
    </AppShell>
  );
}
