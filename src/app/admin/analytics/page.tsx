import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import type { Invoice, Order } from "@/lib/types";

export const revalidate = 0;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}

export default async function AnalyticsPage() {
  const supabase = createClient();
  const [{ data: invoiceData }, { data: orderData }] = await Promise.all([
    supabase.from("invoices").select("*"),
    supabase.from("orders").select("*"),
  ]);

  const invoices = (invoiceData ?? []) as Invoice[];
  const orders = (orderData ?? []) as Order[];
  const paid = invoices.filter((i) => i.status === "paid" && i.paid_at);

  const revenue = (inv: Invoice) => inv.subtotal;
  const profit = (inv: Invoice) =>
    inv.items.reduce(
      (sum, item) =>
        sum + (item.price - (item.cost_price ?? item.price)) * item.qty,
      0
    );

  const today = startOfDay(new Date());
  const thisMonthKey = monthKey(today);

  const todayRevenue = paid
    .filter((i) => dayKey(new Date(i.paid_at!)) === dayKey(today))
    .reduce((s, i) => s + revenue(i), 0);

  const monthRevenue = paid
    .filter((i) => monthKey(new Date(i.paid_at!)) === thisMonthKey)
    .reduce((s, i) => s + revenue(i), 0);

  const monthProfit = paid
    .filter((i) => monthKey(new Date(i.paid_at!)) === thisMonthKey)
    .reduce((s, i) => s + profit(i), 0);

  const totalRevenue = paid.reduce((s, i) => s + revenue(i), 0);
  const totalProfit = paid.reduce((s, i) => s + profit(i), 0);

  // last 7 days revenue, for the bar strip
  const last7: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const value = paid
      .filter((inv) => dayKey(new Date(inv.paid_at!)) === key)
      .reduce((s, inv) => s + revenue(inv), 0);
    last7.push({
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      value,
    });
  }
  const maxLast7 = Math.max(...last7.map((d) => d.value), 1);

  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const unpaidInvoices = invoices.filter((i) => i.status === "unpaid").length;

  return (
    <div className="min-h-screen">
      <AdminNav active="/admin/analytics" />
      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <h1 className="font-display text-2xl mb-6">Analytics</h1>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <StatCard label="Today's sales" value={`MVR ${todayRevenue.toFixed(2)}`} />
          <StatCard label="This month" value={`MVR ${monthRevenue.toFixed(2)}`} />
          <StatCard
            label="This month's profit"
            value={`MVR ${monthProfit.toFixed(2)}`}
          />
          <StatCard label="Orders waiting" value={String(pendingOrders)} />
        </div>

        <div className="mb-10">
          <h2 className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright mb-4">
            Last 7 days
          </h2>
          <div className="flex items-end gap-3 h-32 border-b border-line pb-2">
            {last7.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-copper/70 rounded-t-sm"
                  style={{
                    height: `${Math.max((d.value / maxLast7) * 100, d.value > 0 ? 4 : 0)}%`,
                  }}
                />
                <span className="font-mono text-[10px] text-muted">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="All-time sales" value={`MVR ${totalRevenue.toFixed(2)}`} />
          <StatCard label="All-time profit" value={`MVR ${totalProfit.toFixed(2)}`} />
          <StatCard label="Total orders" value={String(orders.length)} />
          <StatCard label="Unpaid invoices" value={String(unpaidInvoices)} />
        </div>

        <p className="font-body text-xs text-muted mt-8">
          Sales and profit are counted once an invoice is marked as paid.
          Profit uses the cost price you set on each product (or line item).
        </p>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line rounded-lg bg-surface p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-1">
        {label}
      </p>
      <p className="font-display text-xl text-paper">{value}</p>
    </div>
  );
}
