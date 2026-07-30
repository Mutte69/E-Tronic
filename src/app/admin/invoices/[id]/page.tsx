import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import DownloadInvoiceButton from "@/components/DownloadInvoiceButton";
import DeleteInvoiceButton from "@/components/DeleteInvoiceButton";
import { toggleInvoicePaid, createDeliveryNoteFromInvoice } from "@/app/admin/actions";
import SubmitButton from "@/components/SubmitButton";
import { normalizeInvoice } from "@/lib/normalize";
import type { Invoice, Settings } from "@/lib/types";

export const revalidate = 0;

const TERMS =
  "Payment is due upon receipt of this invoice unless otherwise agreed. For bank transfers, please use the invoice number as the payment reference. Items are covered under the relevant manufacturer's warranty where applicable; E Tronic is not liable for damage caused by misuse, unauthorised repair, or normal wear. Please retain this invoice as proof of purchase for any service or warranty claim.";

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
  const inv = normalizeInvoice(invoice as Invoice);
  const s = (settings as Settings) ?? null;
  const isPaid = inv.status === "paid";
  const hasBank = s?.bml_account_number || s?.mib_account_number;

  const { data: existingNote } = await supabase
    .from("delivery_notes")
    .select("id")
    .eq("invoice_id", inv.id)
    .maybeSingle();

  return (
    <div className="min-h-screen">
      <div className="print:hidden">
        <AdminNav active="/admin/invoices" />
      </div>

      <main className="mx-auto max-w-2xl px-5 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <h1 className="font-display text-2xl">Invoice #{inv.invoice_no}</h1>
          <div className="flex items-center gap-3">
            <DownloadInvoiceButton invoice={inv} settings={s} />
            <form action={toggleInvoicePaid.bind(null, inv.id, !isPaid)}>
              <SubmitButton
                pendingText="Updating…"
                className={`rounded-md font-body text-sm font-medium px-4 py-2 transition-colors ${
                  isPaid
                    ? "border border-line text-muted hover:text-paper"
                    : "bg-copper hover:bg-copper-bright text-ink"
                }`}
              >
                {isPaid ? "Mark as unpaid" : "Mark as paid"}
              </SubmitButton>
            </form>
            <DeleteInvoiceButton
              id={inv.id}
              invoiceNo={inv.invoice_no}
              className="rounded-md border border-line text-muted hover:text-copper-bright hover:border-copper/50 transition-colors font-body text-sm px-4 py-2"
            />
          </div>
        </div>

        <div className="relative border border-line rounded-lg bg-surface p-8 bracket-frame">
          {isPaid && (
            <div className="absolute top-8 right-8 rotate-[-12deg] border-4 border-copper text-copper-bright font-display text-3xl tracking-widest px-4 py-1 rounded-md opacity-90">
              PAID
            </div>
          )}

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
              <p className="font-mono text-xs text-muted">Invoice</p>
              <p className="font-display text-lg">#{inv.invoice_no}</p>
              <p className="font-mono text-xs text-muted">
                {new Date(inv.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="border-t border-line mb-6" />

          <div className="mb-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-1">
              Bill to
            </p>
            <p className="font-body text-sm text-paper font-medium">{inv.customer_name}</p>
            {inv.customer_phone && (
              <p className="font-mono text-xs text-muted">{inv.customer_phone}</p>
            )}
            {inv.customer_address && (
              <p className="font-body text-xs text-muted">{inv.customer_address}</p>
            )}
            {inv.customer_tin && (
              <p className="font-mono text-xs text-muted">TIN: {inv.customer_tin}</p>
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
              {inv.items.map((item, i) => (
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

          <div className="flex justify-end mb-10">
            <div className="w-56 border-t border-line pt-3 space-y-1.5">
              <div className="flex justify-between font-body text-sm">
                <span className="text-muted">Subtotal</span>
                <span className="font-mono text-paper">MVR {inv.subtotal.toFixed(2)}</span>
              </div>
              {inv.discount_type !== "none" && (
                <div className="flex justify-between font-body text-sm">
                  <span className="text-muted">
                    Discount
                    {inv.discount_type === "percent" ? ` (${inv.discount_value}%)` : ""}
                  </span>
                  <span className="font-mono text-copper-bright">
                    − MVR {(inv.subtotal - inv.total).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between font-body text-sm pt-1">
                <span className="text-muted">Total due</span>
                <span className="font-mono text-copper-bright text-base">
                  MVR {inv.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-line pt-6 mb-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">
              Terms &amp; conditions
            </p>
            <p className="font-body text-xs text-muted leading-relaxed">{TERMS}</p>
          </div>

          {hasBank && (
            <div className="mb-8">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">
                Payment details
              </p>
              <div className="space-y-2">
                {s?.bml_account_number && (
                  <p className="font-body text-xs text-paper">
                    <span className="font-medium">BML</span>
                    {s.bml_account_name ? ` — ${s.bml_account_name}` : ""}{" "}
                    <span className="font-mono text-copper-bright">
                      {s.bml_account_number}
                    </span>
                  </p>
                )}
                {s?.mib_account_number && (
                  <p className="font-body text-xs text-paper">
                    <span className="font-medium">MIB</span>
                    {s.mib_account_name ? ` — ${s.mib_account_name}` : ""}{" "}
                    <span className="font-mono text-copper-bright">
                      {s.mib_account_number}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-line pt-4 flex items-center justify-between flex-wrap gap-2">
            <p className="font-body text-xs text-muted">
              Prepared by: {s?.invoice_prepared_by || "E Tronic Sales Team"}
            </p>
            <p className="font-body text-xs text-muted">
              For {s?.business_name || "E Tronic"}
            </p>
          </div>
        </div>

        <div className="mt-6 border border-line rounded-lg bg-surface p-6 print:hidden">
          <h2 className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright mb-3">
            Delivery note
          </h2>
          {existingNote ? (
            <Link
              href={`/admin/delivery-notes/${existingNote.id}`}
              className="font-body text-sm text-copper-bright hover:text-copper transition-colors"
            >
              View delivery note →
            </Link>
          ) : (
            <form action={createDeliveryNoteFromInvoice.bind(null, inv.id)} className="space-y-3 max-w-sm">
              <p className="font-body text-xs text-muted">
                Creates a delivery note listing the items and quantities from
                this invoice, without prices — for the customer to sign on
                handover.
              </p>
              <div>
                <label className="block font-body text-xs text-muted mb-1">
                  Received by <span className="text-muted">(optional)</span>
                </label>
                <input
                  name="received_by"
                  className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
                />
              </div>
              <div>
                <label className="block font-body text-xs text-muted mb-1">
                  Notes <span className="text-muted">(optional)</span>
                </label>
                <input
                  name="notes"
                  className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
                />
              </div>
              <SubmitButton
                pendingText="Creating…"
                className="rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium px-4 py-2"
              >
                Create delivery note
              </SubmitButton>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
