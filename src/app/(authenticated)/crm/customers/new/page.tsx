import { RecordPage } from "../../../../../components/templates/RecordPage";
import { createCustomerAction } from '../../../actions';

export const instant = false;

export default async function NewCustomerPage() {
  const breadcrumbs = [
    { label: "CRM", href: "/crm/customers" },
    { label: "Customers", href: "/crm/customers" },
    { label: "New Customer" }
  ];

  return (
    <RecordPage
      breadcrumbs={breadcrumbs}
      title="Create New Customer"
      activeTab="overview"
      tabs={[{ id: "overview", label: "Details" }]}
    >
      <form action={createCustomerAction} className="space-y-8 max-w-3xl">

        {/* GENERAL */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">General Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Legal Name *</label>
              <input type="text" name="legal_name" required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Display Name *</label>
              <input type="text" name="display_name" required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer Type</label>
              <select name="customer_type" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="COMPANY">Company</option>
                <option value="GOVERNMENT">Government</option>
                <option value="EDUCATIONAL">Educational</option>
                <option value="HEALTHCARE">Healthcare</option>
                <option value="INDIVIDUAL">Individual</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Industry</label>
              <input type="text" name="industry" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>
        </section>

        {/* REGISTRATION */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Registration</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Registration Number</label>
              <input type="text" name="registration_number" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">GSTIN</label>
              <input type="text" name="gstin" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">PAN</label>
              <input type="text" name="pan" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Primary Contact Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input type="email" name="email" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="text" name="phone" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Website</label>
              <input type="text" name="website" className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md" />
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4">
          <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700">
            Create Customer
          </button>
        </div>

      </form>
    </RecordPage>
  );
}
