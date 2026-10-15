import Link from "next/link";
import * as Icons from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="text-center py-12 px-8 border border-gray-200 rounded-lg bg-white shadow-sm max-w-md">
        <Icons.FileQuestion className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900">404 - Page Not Found</h3>
        <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto mb-6">
          The page or record you are looking for does not exist or has been removed.
        </p>
        <Link href="/" className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
