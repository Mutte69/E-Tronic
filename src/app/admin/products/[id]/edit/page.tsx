import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProductForm from "@/components/ProductForm";
import { updateProduct } from "@/app/admin/actions";
import type { Product } from "@/lib/types";

export default async function EditProductPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!product) notFound();

  const updateWithId = updateProduct.bind(null, params.id);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto max-w-5xl px-5 sm:px-8 h-16 flex items-center">
          <Link
            href="/admin"
            className="font-body text-sm text-muted hover:text-paper transition-colors"
          >
            &larr; Back to products
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <h1 className="font-display text-2xl mb-6">Edit product</h1>
        <ProductForm product={product as Product} action={updateWithId} />
      </main>
    </div>
  );
}
