import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import SubmitButton from "@/components/SubmitButton";
import { createCategory, deleteCategory } from "@/app/admin/actions";
import type { Category } from "@/lib/types";

export const revalidate = 0;

export default async function CategoriesPage() {
  const supabase = createClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order").order("created_at"),
    supabase.from("products").select("id, category_id"),
  ]);

  const list = (categories ?? []) as Category[];
  const countByCategory = new Map<string, number>();
  (products ?? []).forEach((p) => {
    if (p.category_id) {
      countByCategory.set(p.category_id, (countByCategory.get(p.category_id) ?? 0) + 1);
    }
  });

  return (
    <div className="min-h-screen">
      <AdminNav active="/admin/categories" />
      <main className="mx-auto max-w-3xl px-5 sm:px-8 py-10">
        <h1 className="font-display text-2xl mb-6">Categories</h1>

        <form action={createCategory} className="flex gap-3 mb-8 max-w-md">
          <input
            name="name"
            required
            placeholder="e.g. Meters, Tools, Accessories"
            className="flex-1 rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper placeholder:text-muted/50 focus:border-copper outline-none"
          />
          <SubmitButton
            pendingText="Adding…"
            className="rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium px-4 py-2 whitespace-nowrap"
          >
            + Add
          </SubmitButton>
        </form>

        {list.length === 0 ? (
          <p className="font-body text-muted text-sm">
            No categories yet. Add one above, then assign it to products from
            the product edit page.
          </p>
        ) : (
          <div className="space-y-2">
            {list.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between border border-line rounded-lg bg-surface p-4"
              >
                <div>
                  <p className="font-body text-sm text-paper">{c.name}</p>
                  <p className="font-mono text-xs text-muted">
                    {countByCategory.get(c.id) ?? 0} product
                    {countByCategory.get(c.id) === 1 ? "" : "s"}
                  </p>
                </div>
                <ConfirmDeleteButton
                  action={deleteCategory.bind(null, c.id)}
                  confirmMessage={`Delete "${c.name}"? Products in it will just become uncategorised — they won't be deleted.`}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
