import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import DownloadInvoiceButton from "@/components/DownloadInvoiceButton";
import { toggleInvoicePaid } from "@/app/admin/actions";
import type { Invoice, Settings } from "@/lib/types";

export const revalidate = 0;

export default async function InvoiceViewPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", params.id).single(),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);

  if (!invoice) notFound();
  const inv = invoice as Invoice;
  const isPaid = inv.status === "paid";

  return (
    <div className="min-h-screen">
      <div className="print:hidden">
        <AdminNav active="/admin/invoices" />
      </div>

      <main className="mx-auto max-w-2xl px-5 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <h1 className="font-display text-2xl">Invoice #{inv.invoice_no}</h1>
          <div className="flex items-center gap-3">
            <DownloadInvoiceButton invoice={inv} settings={(settings as Settings) ?? null} />
            <form action={toggleInvoicePaid.bind(null, inv.id, !isPaid)}>
              <button
                className={`rounded-md font-body text-sm font-medium px-4 py-2 transition-colors ${
                  isPaid
                    ? "border border-line text-muted hover:text-paper"
                    : "bg-copper hover:bg-copper-bright text-ink"
                }`}
              >
                {isPaid ? "Mark as unpaid" : "Mark as paid"}
              </button>
            </form>
          </div>
        </div>

        <div className="relative border border-line rounded-lg bg-surface p-8 bracket-frame">
          {isPaid && (
            <div className="absolute top-8 right-8 rotate-[-12deg] border-4 border-copper text-copper-bright font-display text-3xl tracking-widest px-4 py-1 rounded-md opacity-90">
              PAID
            </div>
          )}

          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="relative w-28 h-9 mb-2">
                <Image src="/etronic-logo.png" alt="E Tronic" fill className="object-contain object-left" />
              </div>
              {settings?.address && (
                <p className="font-body text-xs text-muted mt-1">{settings.address}</p>
              )}
              {settings?.phone && (
                <p className="font-mono text-xs text-muted">{settings.phone}</p>
              )}
            </div>
            <div className="text-right">
              <p className="font-mono text-xs text-muted">Invoice</p>
              <p className="font-display text-lg">#{inv.invoice_no}</p>
              <p className="font-mono text-xs text-muted">
                {new Date(inv.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="mb-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-1">
              Bill to
            </p>
            <p className="font-body text-sm text-paper">{inv.customer_name}</p>
            {inv.customer_phone && (
              <p className="font-mono text-xs text-muted">{inv.customer_phone}</p>
            )}
            {inv.customer_address && (
              <p className="font-body text-xs text-muted">{inv.customer_address}</p>
            )}
          </div>

          <table className="w-full mb-6">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-muted pb-2">
                  Item
                </th>
                <th className="text-right font-mono text-[10px] uppercase tracking-widest text-muted pb-2">
                  Qty
                </th>
                <th className="text-right font-mono text-[10px] uppercase tracking-widest text-muted pb-2">
                  Price
                </th>
                <th className="text-right font-mono text-[10px] uppercase tracking-widest text-muted pb-2">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item, i) => (
                <tr key={i} className="border-b border-line/50">
                  <td className="font-body text-sm text-paper py-2">{item.name}</td>
                  <td className="font-mono text-sm text-muted text-right py-2">
                    {item.qty}
                  </td>
                  <td className="font-mono text-sm text-muted text-right py-2">
                    {item.price.toFixed(2)}
                  </td>
                  <td className="font-mono text-sm text-paper text-right py-2">
                    {(item.price * item.qty).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-48">
              <div className="flex justify-between font-body text-sm">
                <span className="text-muted">Total</span>
                <span className="font-mono text-copper-bright text-base">
                  MVR {inv.subtotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
