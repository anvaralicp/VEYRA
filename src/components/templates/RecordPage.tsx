import { ReactNode } from "react";
import { PageHeader } from "../ui/page-header";
import { ContentContainer } from "../ui/content-container";
import { Breadcrumbs, BreadcrumbItem } from "../ui/breadcrumbs";
import { cn } from "../../lib/utils";

interface RecordPageProps {
  breadcrumbs: BreadcrumbItem[];
  title: string;
  recordNumber?: string;
  status?: ReactNode;
  actions?: ReactNode;
  activeTab: string;
  tabs: { id: string; label: string; href?: string }[];
  children: ReactNode;
}

export function RecordPage({ breadcrumbs, title, recordNumber, status, actions, activeTab, tabs, children }: RecordPageProps) {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        breadcrumbs={<Breadcrumbs items={breadcrumbs} />}
        title={recordNumber ? `${recordNumber} - ${title}` : title}
        actions={actions}
        description={status ? <div className="mt-2 inline-flex">{status}</div> : undefined}
      />

      <div className="border-b border-gray-200 bg-white px-6">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            const className = cn(
              isActive
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
              "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors"
            );

            if (tab.href) {
              return (
                <a
                  key={tab.id}
                  href={tab.href}
                  className={className}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.label}
                </a>
              );
            }

            return (
              <button
                key={tab.id}
                type="button"
                className={className}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <ContentContainer className="flex-1 overflow-auto bg-gray-50/50 p-6">
        {children}
      </ContentContainer>
    </div>
  );
}
