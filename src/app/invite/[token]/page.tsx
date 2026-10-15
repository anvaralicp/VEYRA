import Link from "next/link";
import { getInvitationDetails } from "../actions";
import { InviteForm } from "./invite-form";

interface InvitePageProps {
  params: Promise<{ token: string }> | { token: string };
}

export const instant = false;

export default async function InvitePage(props: InvitePageProps) {
  const resolvedParams = await Promise.resolve(props.params);
  const token = resolvedParams?.token;

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
          <p className="text-sm text-gray-600 mb-6">
            The invitation link is missing or invalid.
          </p>
          <Link
            href="/login"
            className="inline-block py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-sm transition-colors"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  const details = await getInvitationDetails(token);

  if (!details.success || !details.invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 text-red-600 mb-4">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {details.isAccepted
              ? "Invitation Already Accepted"
              : details.isExpired
              ? "Invitation Expired"
              : "Invalid Invitation Link"}
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            {details.error ||
              "This invitation is no longer valid. Please contact your organization administrator."}
          </p>
          <Link
            href="/login"
            className="inline-block py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-sm transition-colors"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  const { invitation } = details;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        <div className="text-center mb-6">
          <span className="text-sm font-semibold tracking-wider text-blue-600 uppercase">
            VEYRA
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Join {invitation.tenantName}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            You have been invited to join{" "}
            <span className="font-medium text-gray-800">
              {invitation.tenantName}
            </span>{" "}
            as a{" "}
            <span className="font-semibold text-gray-800">
              {invitation.role}
            </span>
            .
          </p>
        </div>

        {invitation.isExistingUser && !invitation.isAuthenticatedAsOther && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-700">
            Welcome back{invitation.userName ? `, ${invitation.userName}` : ""}!
            {invitation.isAuthenticatedAsInvitee
              ? " You are signed in. Click below to accept the invitation."
              : " Please enter your password to confirm your identity and join this organization."}
          </div>
        )}

        <InviteForm
          token={token}
          isExistingUser={invitation.isExistingUser}
          email={invitation.email}
          tenantName={invitation.tenantName}
          isAuthenticatedAsInvitee={invitation.isAuthenticatedAsInvitee}
          isAuthenticatedAsOther={invitation.isAuthenticatedAsOther}
          currentSessionEmail={invitation.currentSessionEmail}
        />

        <div className="mt-6 text-center text-sm text-gray-500">
          Already have another account?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
