"use client";

import { useActionState } from "react";
import Link from "next/link";
import { acceptInvitationAction } from "../actions";

interface InviteFormProps {
  token: string;
  isExistingUser: boolean;
  email: string;
  tenantName: string;
  isAuthenticatedAsInvitee?: boolean;
  isAuthenticatedAsOther?: boolean;
  currentSessionEmail?: string | null;
}

export function InviteForm({
  token,
  isExistingUser,
  email,
  tenantName,
  isAuthenticatedAsInvitee = false,
  isAuthenticatedAsOther = false,
  currentSessionEmail = null,
}: InviteFormProps) {
  const boundAction = acceptInvitationAction.bind(null, token);
  const [state, formAction, isPending] = useActionState(boundAction, null);

  if (isAuthenticatedAsOther) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
          <p className="font-medium">Active Account Mismatch</p>
          <p className="mt-1 text-xs">
            You are currently signed in as <strong>{currentSessionEmail}</strong>, but this
            invitation was sent to <strong>{email}</strong>.
          </p>
          <p className="mt-2 text-xs text-amber-700">
            Please log out or switch to the matching account to accept this invitation.
          </p>
        </div>
        <Link
          href="/login"
          className="block w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-md text-center text-sm transition-colors"
        >
          Sign in with {email}
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Address
        </label>
        <input
          type="email"
          value={email}
          disabled
          className="w-full px-3 py-2 border border-gray-200 bg-gray-50 text-gray-600 rounded-md cursor-not-allowed text-sm"
        />
      </div>

      {!isExistingUser && (
        <>
          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="name"
            >
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              disabled={isPending}
              placeholder="e.g. Jane Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="password"
            >
              Create Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              minLength={8}
              disabled={isPending}
              placeholder="At least 8 characters"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </>
      )}

      {isExistingUser && !isAuthenticatedAsInvitee && (
        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-1"
            htmlFor="password"
          >
            Account Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            disabled={isPending}
            placeholder="Enter your VEYRA password"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            Confirm your password to link your account to {tenantName}.
          </p>
        </div>
      )}

      {state?.error && (
        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
      >
        {isPending
          ? "Joining..."
          : isExistingUser
          ? `Accept Invitation & Join ${tenantName}`
          : `Create Account & Join ${tenantName}`}
      </button>
    </form>
  );
}
