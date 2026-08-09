import { createClient } from "@/lib/supabase/server";
import ProductForm from "@/components/ProductForm";
import AdminNav from "@/components/AdminNav";
import { createProduct } from "@/app/admin/actions";
import type { Category } from "@/lib/types";

export default async function NewProductPage() {
  const supabase = createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order")
    .order("created_at");

  return (
    <div className="min-h-screen">
      <AdminNav active="/admin" />
      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <h1 className="font-display text-2xl mb-6">Add product</h1>
        <ProductForm action={createProduct} categories={(categories ?? []) as Category[]} />
      </main>
    </div>
  );
}
