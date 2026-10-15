"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "./actions";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerAction, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4" suppressHydrationWarning>
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-sm border border-gray-200" suppressHydrationWarning>
        <div className="text-center mb-6" suppressHydrationWarning>
          <span className="text-sm font-semibold tracking-wider text-blue-600 uppercase">
            VEYRA
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Create your organization
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Set up your company workspace and get started in seconds
          </p>
        </div>

        <form action={formAction} className="space-y-4" suppressHydrationWarning>
          <div suppressHydrationWarning>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="organizationName"
            >
              Organization Name
            </label>
            <input
              type="text"
              id="organizationName"
              name="organizationName"
              required
              disabled={isPending}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Acme Systems Ltd"
            />
          </div>

          <div suppressHydrationWarning>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="name"
            >
              Your Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              disabled={isPending}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="John Doe"
            />
          </div>

          <div suppressHydrationWarning>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="email"
            >
              Work Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              disabled={isPending}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="john@acme.com"
            />
          </div>

          <div suppressHydrationWarning>
            <label
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="password"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              minLength={8}
              disabled={isPending}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="At least 8 characters"
            />
          </div>

          {state?.error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100" suppressHydrationWarning>
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Setting up organization..." : "Create Organization"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600" suppressHydrationWarning>
          Already have an account?{" "}
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
