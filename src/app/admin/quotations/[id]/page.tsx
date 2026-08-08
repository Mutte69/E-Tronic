import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import DownloadQuotationButton from "@/components/DownloadQuotationButton";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import SubmitButton from "@/components/SubmitButton";
import { convertQuotationToInvoice, deleteQuotation } from "@/app/admin/actions";
import { normalizeQuotation } from "@/lib/normalize";
import type { Quotation, Settings } from "@/lib/types";

export const revalidate = 0;

export default async function QuotationViewPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const [{ data: quotation }, { data: settings }] = await Promise.all([
    supabase.from("quotations").select("*").eq("id", params.id).single(),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);

  if (!quotation) notFound();
  const q = normalizeQuotation(quotation as Quotation);
  const s = (settings as Settings) ?? null;
  const isConverted = q.status === "converted";

  return (
    <div className="min-h-screen">
      <AdminNav active="/admin/quotations" />

      <main className="mx-auto max-w-2xl px-5 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="font-display text-2xl">Quote-{q.quotation_no}</h1>
          <div className="flex items-center gap-3">
            <DownloadQuotationButton quotation={q} settings={s} />
            {isConverted ? (
              <Link
                href={`/admin/invoices/${q.converted_invoice_id}`}
                className="rounded-md border border-copper/50 text-copper-bright hover:bg-copper hover:text-ink transition-colors font-body text-sm px-4 py-2"
              >
                View invoice
              </Link>
            ) : (
              <form action={convertQuotationToInvoice.bind(null, q.id)}>
                <SubmitButton
                  pendingText="Converting…"
                  className="rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium px-4 py-2"
                >
                  Convert to invoice
                </SubmitButton>
              </form>
            )}
            <ConfirmDeleteButton
              action={deleteQuotation.bind(null, q.id)}
              confirmMessage={`Delete Quote-${q.quotation_no}? This can't be undone.`}
              className="rounded-md border border-line text-muted hover:text-copper-bright hover:border-copper/50 transition-colors font-body text-sm px-4 py-2"
            />
          </div>
        </div>

        <div className="border border-line rounded-lg bg-surface p-8 bracket-frame">
          <div className="flex items-start justify-between mb-8 gap-6 flex-wrap">
            <div>
              <div className="relative w-28 h-9 mb-2">
                <Image src="/etronic-logo.png" alt="E Tronic" fill className="object-contain object-left" />
              </div>
              {s?.registration_number && (
                <p className="font-mono text-[10px] text-muted mt-1">
                  Reg. No. {s.registration_number}
                </p>
              )}
              {s?.address && <p className="font-body text-xs text-muted mt-1">{s.address}</p>}
              {s?.phone && <p className="font-mono text-xs text-muted">{s.phone}</p>}
            </div>
            <div className="text-right">
              <p className="font-mono text-xs text-muted">Quotation</p>
              <p className="font-display text-lg">Quote-{q.quotation_no}</p>
              <p className="font-mono text-xs text-muted">
                {new Date(q.created_at).toLocaleDateString()}
              </p>
              {q.valid_until && (
                <p className="font-mono text-xs text-copper-bright">
                  Valid until {new Date(q.valid_until).toLocaleDateString()}
                </p>
              )}
              <div className="flex items-center gap-1.5 justify-end mt-1 flex-wrap">
                {q.created_by === "customer" && (
                  <span className="inline-block font-mono text-[10px] uppercase tracking-wide border border-line text-muted px-2 py-0.5 rounded-sm">
                    From website
                  </span>
                )}
                {isConverted && (
                  <span className="inline-block font-mono text-[10px] uppercase tracking-wide border border-copper text-copper-bright px-2 py-0.5 rounded-sm">
                    Converted
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-line mb-6" />

          <div className="mb-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-1">
              Quoted to
            </p>
            <p className="font-body text-sm text-paper font-medium">{q.customer_name}</p>
            {q.customer_phone && (
              <p className="font-mono text-xs text-muted">{q.customer_phone}</p>
            )}
            {q.customer_address && (
              <p className="font-body text-xs text-muted">{q.customer_address}</p>
            )}
            {q.customer_tin && (
              <p className="font-mono text-xs text-muted">TIN: {q.customer_tin}</p>
            )}
          </div>

          <table className="w-full mb-2">
            <thead>
              <tr className="bg-ink">
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-muted px-3 py-2">
                  Item
                </th>
                <th className="text-right font-mono text-[10px] uppercase tracking-widest text-muted px-3 py-2">
                  Qty
                </th>
                <th className="text-right font-mono text-[10px] uppercase tracking-widest text-muted px-3 py-2">
                  Price
                </th>
                <th className="text-right font-mono text-[10px] uppercase tracking-widest text-muted px-3 py-2">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {q.items.map((item, i) => (
                <tr key={i} className={i % 2 === 1 ? "bg-surface-raised" : ""}>
                  <td className="font-body text-sm text-paper py-2 px-3">{item.name}</td>
                  <td className="font-mono text-sm text-muted text-right py-2 px-3">
                    {item.qty}
                  </td>
                  <td className="font-mono text-sm text-muted text-right py-2 px-3">
                    {item.price.toFixed(2)}
                  </td>
                  <td className="font-mono text-sm text-paper text-right py-2 px-3">
                    {(item.price * item.qty).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end mb-8">
            <div className="w-56 border-t border-line pt-3 space-y-1.5">
              <div className="flex justify-between font-body text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="font-mono text-paper">MVR {q.subtotal.toFixed(2)}</span>
              </div>
              {q.discount_type !== "none" && (
                <div className="flex justify-between font-body text-sm">
                  <span className="text-muted">
                    Discount
                    {q.discount_type === "percent" ? ` (${q.discount_value}%)` : ""}
                  </span>
                  <span className="font-mono text-copper-bright">
                    − MVR {(q.subtotal - q.total).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-body text-sm pt-1">
                <span className="text-muted">Grand total</span>
                <span className="font-mono text-copper-bright text-base">
                  MVR {q.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {(q.delivery_terms || q.payment_terms) && (
            <div className="border-t border-line pt-6 space-y-1.5">
              {q.delivery_terms && (
                <p className="font-body text-xs text-muted">
                  <span className="font-medium text-paper">Delivery:</span> {q.delivery_terms}
                </p>
              )}
              {q.payment_terms && (
                <p className="font-body text-xs text-muted">
                  <span className="font-medium text-paper">Payment:</span> {q.payment_terms}
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
