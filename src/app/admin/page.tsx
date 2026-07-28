import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { signOut, toggleFeatured, toggleInStock } from "@/app/admin/actions";
import DeleteProductButton from "@/components/DeleteProductButton";
import type { Product } from "@/lib/types";

export const revalidate = 0;

export default async function AdminDashboard() {
  const supabase = createClient();
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const list = (products ?? []) as Product[];

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto max-w-5xl px-5 sm:px-8 h-16 flex items-center justify-between">
          <p className="font-display text-lg">
            <span className="text-copper-bright">E</span>tronic{" "}
            <span className="text-muted font-body text-sm">admin</span>
          </p>
          <div className="flex items-center gap-5">
            <Link
              href="/admin/settings"
              className="font-body text-sm text-muted hover:text-paper transition-colors"
            >
              Settings
            </Link>
            <Link
              href="/"
              className="font-body text-sm text-muted hover:text-paper transition-colors"
            >
              View site
            </Link>
            <form action={signOut}>
              <button className="font-body text-sm text-muted hover:text-copper-bright transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl">Products</h1>
          <Link
            href="/admin/products/new"
            className="rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium px-4 py-2"
          >
            + Add product
          </Link>
        </div>

        {list.length === 0 ? (
          <p className="font-body text-muted text-sm">
            No products yet. Add your first one above.
          </p>
        ) : (
          <div className="space-y-3">
            {list.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 border border-line rounded-lg bg-surface p-3"
              >
                <div className="relative w-16 h-16 rounded-md overflow-hidden bg-surface-raised shrink-0">
                  {p.image_url && (
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm text-paper truncate">{p.name}</p>
                  <p className="font-mono text-xs text-copper-bright">
                    MVR {p.price.toFixed(2)}
                  </p>
                </div>

                <form action={toggleFeatured.bind(null, p.id, !p.featured)}>
                  <button
                    className={`font-mono text-[10px] uppercase tracking-wide px-2 py-1 rounded-sm border ${
                      p.featured
                        ? "bg-copper text-ink border-copper"
                        : "border-line text-muted hover:text-paper"
                    }`}
                  >
                    Featured
                  </button>
                </form>

                <form action={toggleInStock.bind(null, p.id, !p.in_stock)}>
                  <button
                    className={`font-mono text-[10px] uppercase tracking-wide px-2 py-1 rounded-sm border ${
                      p.in_stock
                        ? "border-line text-muted hover:text-paper"
                        : "bg-surface-raised text-muted border-line"
                    }`}
                  >
                    {p.in_stock ? "In stock" : "Out of stock"}
                  </button>
                </form>

                <Link
                  href={`/admin/products/${p.id}/edit`}
                  className="font-mono text-xs text-copper-bright hover:text-copper transition-colors"
                >
                  Edit
                </Link>

                <DeleteProductButton id={p.id} name={p.name} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
