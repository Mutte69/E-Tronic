import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductForm from "@/components/ProductForm";
import AdminNav from "@/components/AdminNav";
import { updateProduct } from "@/app/admin/actions";
import type { Product, Category } from "@/lib/types";

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("id", params.id).single(),
    supabase.from("categories").select("*").order("sort_order").order("created_at"),
  ]);

  if (!product) notFound();

  const updateWithId = updateProduct.bind(null, params.id);

  return (
    <div className="min-h-screen">
      <AdminNav active="/admin" />
      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <h1 className="font-display text-2xl mb-6">Edit product</h1>
        <ProductForm
          product={product as Product}
          action={updateWithId}
          categories={(categories ?? []) as Category[]}
        />
      </main>
    </div>
  );
}
