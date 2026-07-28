import AdminNav from "@/components/AdminNav";
import NewInvoiceForm from "@/components/NewInvoiceForm";

export default function NewInvoicePage() {
  return (
    <div className="min-h-screen">
      <AdminNav active="/admin/invoices" />
      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <h1 className="font-display text-2xl mb-6">New invoice</h1>
        <NewInvoiceForm />
      </main>
    </div>
  );
}
