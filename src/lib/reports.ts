import type { Invoice } from "@/lib/types";

export function invoiceProfit(inv: Invoice): number {
  return inv.items.reduce(
    (sum, item) => sum + (item.price - (item.cost_price ?? item.price)) * item.qty,
    0
  );
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}

export type ReportRow = {
  invoice_no: number;
  date: string;
  customer_name: string;
  items: string;
  sales: number;
  profit: number;
};

function toRows(invoices: Invoice[]): ReportRow[] {
  return invoices
    .filter((i) => i.status === "paid" && i.paid_at)
    .map((i) => ({
      invoice_no: i.invoice_no,
      date: new Date(i.paid_at!).toLocaleDateString(),
      customer_name: i.customer_name,
      items: i.items.map((it) => `${it.qty}x ${it.name}`).join(", "),
      sales: i.subtotal,
      profit: invoiceProfit(i),
    }));
}

export function buildDailyReport(invoices: Invoice[], date = new Date()) {
  const key = dayKey(date);
  const paid = invoices.filter(
    (i) => i.status === "paid" && i.paid_at && dayKey(new Date(i.paid_at)) === key
  );
  const rows = toRows(paid);
  const sales = rows.reduce((s, r) => s + r.sales, 0);
  const profit = rows.reduce((s, r) => s + r.profit, 0);
  return {
    label: date.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    filenamePart: key,
    rows,
    sales,
    profit,
  };
}

export function buildMonthlyReport(invoices: Invoice[], date = new Date()) {
  const key = monthKey(date);
  const paid = invoices.filter(
    (i) => i.status === "paid" && i.paid_at && monthKey(new Date(i.paid_at)) === key
  );
  const rows = toRows(paid);
  const sales = rows.reduce((s, r) => s + r.sales, 0);
  const profit = rows.reduce((s, r) => s + r.profit, 0);
  return {
    label: date.toLocaleDateString(undefined, { year: "numeric", month: "long" }),
    filenamePart: key,
    rows,
    sales,
    profit,
  };
}

export type Report = ReturnType<typeof buildDailyReport>;
