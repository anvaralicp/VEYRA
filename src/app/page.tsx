import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-gray-50 text-gray-900">
      <main className="flex flex-col items-center max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          VEYRA Platform
        </h1>
        <p className="text-lg text-gray-600">
          Modular SaaS Foundation. Build CRM, Sales, Procurement, and more on a solid multi-tenant architecture.
        </p>
        <div className="flex space-x-4 mt-8">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition"
          >
            Go to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
