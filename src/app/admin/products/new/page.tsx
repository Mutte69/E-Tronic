import Link from "next/link";
import ProductForm from "@/components/ProductForm";
import { createProduct } from "@/app/admin/actions";

export default function NewProductPage() {
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
        <h1 className="font-display text-2xl mb-6">Add product</h1>
        <ProductForm action={createProduct} />
      </main>
    </div>
  );
}
