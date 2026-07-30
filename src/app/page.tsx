import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";
import CartDrawer from "@/components/CartDrawer";
import type { Product, Settings } from "@/lib/types";

export const revalidate = 0;

export default async function HomePage({
  searchParams,
}: {
  searchParams: { order_error?: string; order_saved?: string };
}) {
  const supabase = createClient();

  const [{ data: products }, { data: settings }] = await Promise.all([
    supabase
      .from("products")
      .select("id,name,code,caption,price,stock_qty,image_url,featured,sort_order,in_stock,created_at,updated_at")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);

  const allProducts = ((products ?? []) as Omit<Product, "cost_price">[]).map((p) => ({
    ...p,
    cost_price: null,
  })) as Product[];
  const featured = allProducts.filter((p) => p.featured);
  const rest = allProducts.filter((p) => !p.featured);
  const s = (settings as Settings) ?? null;

  return (
    <>
      <Header />

      {searchParams?.order_error && (
        <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-6">
          <p className="font-body text-sm text-copper-bright bg-copper/10 border border-copper/30 rounded-md px-4 py-3">
            Something went wrong sending your order. Please try again, or
            contact us directly.
          </p>
        </div>
      )}
      {searchParams?.order_saved && (
        <div className="mx-auto max-w-6xl px-5 sm:px-8 pt-6">
          <p className="font-body text-sm text-copper-bright bg-copper/10 border border-copper/30 rounded-md px-4 py-3">
            Your order was saved. We&rsquo;ll reach out to confirm it shortly.
          </p>
        </div>
      )}

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8 pt-16 pb-10">
        <div className="bracket-frame border border-line rounded-lg bg-grid bg-[length:28px_28px] px-6 sm:px-10 py-14 sm:py-20 animate-fade-in-up">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-copper-bright mb-4">
            {s?.hero_eyebrow || "Male\u2019, Maldives"}
          </p>
          <h1 className="font-display text-4xl sm:text-6xl leading-[1.05] text-balance max-w-2xl whitespace-pre-line">
            {s?.hero_heading || "Electronics, sold and serviced right."}
          </h1>
          <p className="font-body text-muted mt-5 max-w-md text-sm sm:text-base whitespace-pre-line">
            {s?.hero_subtext ||
              "Devices, parts, and repairs from E Tronic. Reach out below for stock, pricing, or a service booking."}
          </p>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-6xl px-5 sm:px-8 py-10">
        <SectionLabel>What we do</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <ServiceCard
            title={s?.service_1_title || "Sales"}
            body={
              s?.service_1_body ||
              "New and quality electronics, priced fairly, with stock updated here as it comes in."
            }
          />
          <ServiceCard
            title={s?.service_2_title || "Repair & service"}
            body={
              s?.service_2_body ||
              "Diagnostics and repairs on the devices we sell and beyond — bring it in or message us the issue."
            }
          />
          <ServiceCard
            title={s?.service_3_title || "Support"}
            body={
              s?.service_3_body ||
              "Questions about a part, a price, or what fits your setup — reach out on WhatsApp any time."
            }
          />
        </div>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 sm:px-8 py-6">
          <SectionLabel>Featured</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            {featured.map((p, i) => (
              <div key={p.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All products */}
      <section id="products" className="mx-auto max-w-6xl px-5 sm:px-8 py-10">
        <SectionLabel>All Products</SectionLabel>
        {rest.length === 0 && featured.length === 0 ? (
          <p className="font-body text-muted text-sm mt-4">
            No products listed yet. Check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
            {rest.map((p, i) => (
              <div key={p.id} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(i * 60, 400)}ms` }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        )}
      </section>

      <Footer settings={s} />
      <CartDrawer />
    </>
  );
}

function ServiceCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-line rounded-lg bg-surface p-5">
      <p className="font-display text-sm text-copper-bright mb-2">{title}</p>
      <p className="font-body text-sm text-muted leading-relaxed">{body}</p>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-sm tracking-[0.2em] uppercase text-muted flex items-center gap-3">
      <span className="w-6 h-px bg-copper" />
      {children}
    </h2>
  );
}
