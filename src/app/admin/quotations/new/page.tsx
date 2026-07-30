import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import NewQuotationForm from "@/components/NewQuotationForm";
import type { Product } from "@/lib/types";

export default async function NewQuotationPage() {
  const supabase = createClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div className="min-h-screen">
      <AdminNav active="/admin/quotations" />
      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <h1 className="font-display text-2xl mb-6">New quotation</h1>
        <NewQuotationForm products={(products ?? []) as Product[]} />
      </main>
    </div>
  );
}
