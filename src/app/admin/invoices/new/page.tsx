import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import NewInvoiceForm from "@/components/NewInvoiceForm";
import type { Product } from "@/lib/types";

export default async function NewInvoicePage() {
  const supabase = createClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div className="min-h-screen">
      <AdminNav active="/admin/invoices" />
      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <h1 className="font-display text-2xl mb-6">New invoice</h1>
        <NewInvoiceForm products={(products ?? []) as Product[]} />
      </main>
    </div>
  );
}
