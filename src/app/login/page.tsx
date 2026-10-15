"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4" suppressHydrationWarning>
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-sm border border-gray-200" suppressHydrationWarning>
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900" suppressHydrationWarning>
          Sign in to VEYRA
        </h1>
        <form action={formAction} className="space-y-4" suppressHydrationWarning>
          <div suppressHydrationWarning>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              disabled={isPending}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@company.com"
            />
          </div>
          <div suppressHydrationWarning>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              disabled={isPending}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
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
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600" suppressHydrationWarning>
          Need to set up a company workspace?{" "}
          <a
            href="/register"
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Create an organization
          </a>
        </div>
      </div>
    </div>
  );
}
