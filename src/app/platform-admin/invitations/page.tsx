import Link from "next/link";
import { db } from "../../../prisma/db";
import { getModel } from "../../../lib/db/legacy-adapter";
import { requirePlatformPermission } from "../../../lib/auth/platform";
import { MailCheck, Shield } from "lucide-react";
import { revokeTenantAdminInvitationAction } from "../actions";

export const dynamic = "force-dynamic";

interface PlatformInvitationItem {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string | Date;
  created_at: string | Date;
}

export default async function PlatformInvitationsPage() {
  await requirePlatformPermission("platform.tenant.invite_admin");

  const Invitation = getModel(db, "Invitation");
  const Tenant = getModel(db, "Tenant");

  let invitations: PlatformInvitationItem[] = [];
  try {
    if (Invitation && typeof Invitation.findMany === "function") {
      const invs = await Invitation.findMany({
        select: {
          id: true,
          tenant_id: true,
          email: true,
          role: true,
          status: true,
          expires_at: true,
          created_at: true,
        },
      });
      if (Array.isArray(invs)) {
        invitations = (invs as PlatformInvitationItem[]).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
    }
  } catch {
    invitations = [];
  }

  // Pre-fetch tenant names (least-data-access projection)
  const tenantMap = new Map<string, string>();
  try {
    if (Tenant && typeof Tenant.findMany === "function") {
      const tenants = await Tenant.findMany({
        select: {
          id: true,
          name: true,
        },
      });
      if (Array.isArray(tenants)) {
        for (const t of tenants) {
          tenantMap.set(t.id, t.name);
        }
      }
    }
  } catch {
    // Ignore
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <MailCheck className="w-5 h-5 text-purple-400" />
            Administrator Onboarding & Invitations
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Global lifecycle oversight for single-use administrator onboarding tokens. Tokens are stored as SHA-256 hashes.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Zero Credential Disclosure</span>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {invitations.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No administrator invitations found in the platform database.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Recipient Email</th>
                  <th className="py-3 px-4">Target Organization</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Expires</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invitations.map((inv) => {
                  const orgName = tenantMap.get(inv.tenant_id) || inv.tenant_id;
                  const isExpired = new Date() > new Date(inv.expires_at);
                  const effectiveStatus = inv.status === "PENDING" && isExpired ? "EXPIRED" : inv.status;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{inv.email}</div>
                        <div className="font-mono text-[10px] text-slate-500 mt-0.5">Token: SHA-256 Hashed</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <Link
                          href={`/platform-admin/tenants/${inv.tenant_id}`}
                          className="font-medium text-indigo-400 hover:text-indigo-300"
                        >
                          {orgName}
                        </Link>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                          {inv.role}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            effectiveStatus === "ACCEPTED"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : effectiveStatus === "EXPIRED"
                              ? "bg-slate-800 text-slate-500"
                              : effectiveStatus === "REVOKED"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}
                        >
                          {effectiveStatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {inv.status === "PENDING" && !isExpired && (
                          <form action={revokeTenantAdminInvitationAction}>
                            <input type="hidden" name="invitationId" value={inv.id} />
                            <input type="hidden" name="tenantId" value={inv.tenant_id} />
                            <button
                              type="submit"
                              className="text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/80 px-2.5 py-1 rounded border border-rose-800/40 transition-colors"
                            >
                              Revoke
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
