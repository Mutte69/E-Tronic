import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import ReportDownloads from "@/components/ReportDownloads";
import { invoiceProfit } from "@/lib/reports";
import type { Invoice, Order, Settings } from "@/lib/types";

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
  const [{ data: invoiceData }, { data: orderData }, { data: settingsData }] = await Promise.all([
    supabase.from("invoices").select("*"),
    supabase.from("orders").select("*"),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);

  const invoices = (invoiceData ?? []) as Invoice[];
  const orders = (orderData ?? []) as Order[];
  const settings = (settingsData as Settings) ?? null;
  const paid = invoices.filter((i) => i.status === "paid" && i.paid_at);

  const revenue = (inv: Invoice) => inv.subtotal;

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
    .reduce((s, i) => s + invoiceProfit(i), 0);

  const monthMargin = monthRevenue > 0 ? (monthProfit / monthRevenue) * 100 : 0;

  const totalRevenue = paid.reduce((s, i) => s + revenue(i), 0);
  const totalProfit = paid.reduce((s, i) => s + invoiceProfit(i), 0);
  const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // last 7 days: sales + profit, for the chart
  const last7: { label: string; sales: number; profit: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dayKey(d);
    const dayInvoices = paid.filter((inv) => dayKey(new Date(inv.paid_at!)) === key);
    const sales = dayInvoices.reduce((s, inv) => s + revenue(inv), 0);
    const profit = dayInvoices.reduce((s, inv) => s + invoiceProfit(inv), 0);
    last7.push({
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      sales,
      profit,
    });
  }
  const maxLast7 = Math.max(...last7.map((d) => Math.max(d.sales, d.profit)), 1);
  const hasAnyData = last7.some((d) => d.sales > 0);

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
            sub={`${monthMargin.toFixed(1)}% margin`}
          />
          <StatCard label="Orders waiting" value={String(pendingOrders)} />
        </div>

        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright">
              Last 7 days
            </h2>
            <div className="flex items-center gap-4 font-mono text-[10px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-copper inline-block" /> Sales
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-copper-bright/40 border border-copper-bright inline-block" />{" "}
                Profit
              </span>
            </div>
          </div>

          {!hasAnyData ? (
            <p className="font-body text-sm text-muted border border-line rounded-lg bg-surface p-6 text-center">
              No paid invoices yet this week — sales will chart here once invoices are marked paid.
            </p>
          ) : (
            <div className="flex items-end gap-4 h-40 border-b border-line pb-2">
              {last7.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-1 h-32">
                    <div
                      className="w-1/2 bg-copper rounded-t-sm min-h-[2px] relative group"
                      style={{ height: `${Math.max((d.sales / maxLast7) * 100, d.sales > 0 ? 4 : 1)}%` }}
                      title={`Sales: MVR ${d.sales.toFixed(2)}`}
                    />
                    <div
                      className="w-1/2 bg-copper-bright/40 border border-copper-bright rounded-t-sm min-h-[2px]"
                      style={{ height: `${Math.max((d.profit / maxLast7) * 100, d.profit > 0 ? 4 : 1)}%` }}
                      title={`Profit: MVR ${d.profit.toFixed(2)}`}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-muted">{d.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <StatCard label="All-time sales" value={`MVR ${totalRevenue.toFixed(2)}`} />
          <StatCard
            label="All-time profit"
            value={`MVR ${totalProfit.toFixed(2)}`}
            sub={`${totalMargin.toFixed(1)}% margin`}
          />
          <StatCard label="Total orders" value={String(orders.length)} />
          <StatCard label="Unpaid invoices" value={String(unpaidInvoices)} />
        </div>

        <h2 className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright mb-4">
          Download reports
        </h2>
        <ReportDownloads invoices={invoices} settings={settings} />

        <p className="font-body text-xs text-muted mt-8">
          Sales and profit are counted once an invoice is marked as paid.
          Profit and margin use the cost price you set on each product (or line item).
        </p>
      </main>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-line rounded-lg bg-surface p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-1">
        {label}
      </p>
      <p className="font-display text-xl text-paper">{value}</p>
      {sub && <p className="font-mono text-[10px] text-copper-bright mt-1">{sub}</p>}
    </div>
  );
}
