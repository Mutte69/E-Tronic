import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import DeleteInvoiceButton from "@/components/DeleteInvoiceButton";
import { normalizeInvoices } from "@/lib/normalize";
import type { Invoice } from "@/lib/types";

export const revalidate = 0;

export default async function InvoicesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });

  const invoices = normalizeInvoices((data ?? []) as Invoice[]);

  return (
    <div className="min-h-screen">
      <AdminNav active="/admin/invoices" />
      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl">Invoices</h1>
          <Link
            href="/admin/invoices/new"
            className="rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium px-4 py-2"
          >
            + New invoice
          </Link>
        </div>

        {invoices.length === 0 ? (
          <p className="font-body text-muted text-sm">No invoices yet.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 border border-line rounded-lg bg-surface p-4 hover:border-copper/50 transition-colors"
              >
                <Link href={`/admin/invoices/${inv.id}`} className="flex-1 min-w-0 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted">
                      #{inv.invoice_no}
                      {inv.discount_type !== "none" && (
                        <span className="ml-2 text-copper-bright">discount</span>
                      )}
                    </p>
                    <p className="font-body text-sm text-paper truncate">{inv.customer_name}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-mono text-sm text-copper-bright">
                      MVR {inv.total.toFixed(2)}
                    </span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-wide px-2 py-1 rounded-sm border ${
                        inv.status === "paid"
                          ? "border-copper text-copper-bright"
                          : "border-line text-muted"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                </Link>
                <DeleteInvoiceButton id={inv.id} invoiceNo={inv.invoice_no} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
