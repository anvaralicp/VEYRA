import { ReactNode } from "react";
import { PageHeader } from "../ui/page-header";
import { ContentContainer } from "../ui/content-container";
import * as Icons from "lucide-react";

interface ListPageProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode; // Table goes here
}

export function ListPage({ title, description, actions, children }: ListPageProps) {
  return (
    <div className="flex flex-col h-full bg-gray-50/50">
      <PageHeader
        title={title}
        description={description}
        actions={actions}
      />

      <ContentContainer className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
          {/* List Toolbar */}
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50">
            <div className="relative max-w-sm w-full">
              <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                <Icons.Filter className="h-4 w-4" />
                Filter
              </button>
              <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                <Icons.LayoutTemplate className="h-4 w-4" />
                Columns
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>

          {/* Pagination Placeholder */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm text-gray-600">
            <div>Showing 1 to 10 of 20 results</div>
            <div className="flex items-center gap-2">
              <button className="p-1 rounded hover:bg-gray-200 disabled:opacity-50" disabled>
                <Icons.ChevronLeft className="h-5 w-5" />
              </button>
              <button className="p-1 rounded hover:bg-gray-200">
                <Icons.ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </ContentContainer>
    </div>
  );
}
