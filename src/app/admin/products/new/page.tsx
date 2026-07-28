import ProductForm from "@/components/ProductForm";
import AdminNav from "@/components/AdminNav";
import { createProduct } from "@/app/admin/actions";

export default function NewProductPage() {
  return (
    <div className="min-h-screen">
      <AdminNav active="/admin" />
      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <h1 className="font-display text-2xl mb-6">Add product</h1>
        <ProductForm action={createProduct} />
      </main>
    </div>
  );
}
