"use client";

import { ErrorState } from "../components/ui/states";
import Link from "next/link";
import * as Icons from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isForbidden = error.message?.includes("FORBIDDEN") || error.message?.includes("403");
  const isUnauth = error.message?.includes("UNAUTHENTICATED") || error.message?.includes("401");

  if (isForbidden) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <ErrorState
          title="403 - Access Denied"
          message="You do not have permission to view this resource. Please contact your tenant administrator if you believe this is an error."
          className="max-w-md border-orange-200 bg-orange-50"
        />
      </div>
    );
  }

  if (isUnauth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="text-center py-12 px-4 border border-blue-200 rounded-lg bg-blue-50 max-w-md">
          <Icons.ShieldAlert className="mx-auto h-12 w-12 text-blue-400 mb-4" />
          <h3 className="text-sm font-semibold text-blue-800">401 - Session Expired</h3>
          <p className="mt-1 text-sm text-blue-600 max-w-sm mx-auto mb-6">Your session has expired or you are not logged in.</p>
          <Link href="/login" className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <ErrorState
        title="500 - Unexpected Error"
        message="The application encountered an unexpected error. Our team has been notified."
        onRetry={() => reset()}
        className="max-w-md"
      />
    </div>
  );
}
