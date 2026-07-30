import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import DownloadDeliveryNoteButton from "@/components/DownloadDeliveryNoteButton";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";
import { deleteDeliveryNote } from "@/app/admin/actions";
import { normalizeDeliveryNote } from "@/lib/normalize";
import type { DeliveryNote, Settings } from "@/lib/types";

export const revalidate = 0;

export default async function DeliveryNoteViewPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const [{ data: note }, { data: settings }] = await Promise.all([
    supabase.from("delivery_notes").select("*").eq("id", params.id).single(),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);

  if (!note) notFound();
  const dn = normalizeDeliveryNote(note as DeliveryNote);
  const s = (settings as Settings) ?? null;

  return (
    <div className="min-h-screen">
      <AdminNav active="/admin/delivery-notes" />

      <main className="mx-auto max-w-2xl px-5 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="font-display text-2xl">DN-{dn.delivery_no}</h1>
          <div className="flex items-center gap-3">
            <DownloadDeliveryNoteButton note={dn} settings={s} />
            {dn.invoice_id && (
              <Link
                href={`/admin/invoices/${dn.invoice_id}`}
                className="rounded-md border border-line text-muted hover:text-paper transition-colors font-body text-sm px-4 py-2"
              >
                View invoice
              </Link>
            )}
            <ConfirmDeleteButton
              action={deleteDeliveryNote.bind(null, dn.id)}
              confirmMessage={`Delete DN-${dn.delivery_no}? This can't be undone.`}
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
              {s?.address && <p className="font-body text-xs text-muted mt-1">{s.address}</p>}
              {s?.phone && <p className="font-mono text-xs text-muted">{s.phone}</p>}
            </div>
            <div className="text-right">
              <p className="font-mono text-xs text-muted">Delivery note</p>
              <p className="font-display text-lg">DN-{dn.delivery_no}</p>
              <p className="font-mono text-xs text-muted">
                {new Date(dn.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="border-t border-line mb-6" />

          <div className="mb-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-1">
              Deliver to
            </p>
            <p className="font-body text-sm text-paper font-medium">{dn.customer_name}</p>
            {dn.customer_phone && (
              <p className="font-mono text-xs text-muted">{dn.customer_phone}</p>
            )}
            {dn.customer_address && (
              <p className="font-body text-xs text-muted">{dn.customer_address}</p>
            )}
          </div>

          <table className="w-full mb-8">
            <thead>
              <tr className="bg-ink">
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-muted px-3 py-2">
                  Item
                </th>
                <th className="text-right font-mono text-[10px] uppercase tracking-widest text-muted px-3 py-2">
                  Qty
                </th>
              </tr>
            </thead>
            <tbody>
              {dn.items.map((item, i) => (
                <tr key={i} className={i % 2 === 1 ? "bg-surface-raised" : ""}>
                  <td className="font-body text-sm text-paper py-2 px-3">{item.name}</td>
                  <td className="font-mono text-sm text-muted text-right py-2 px-3">
                    {item.qty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {dn.notes && (
            <p className="font-body text-xs text-muted mb-8">
              <span className="font-medium text-paper">Notes:</span> {dn.notes}
            </p>
          )}

          <div className="flex justify-between pt-8 mt-8 border-t border-line">
            <div>
              <div className="w-40 border-t border-line pt-1">
                <p className="font-body text-xs text-muted">
                  {dn.received_by || "Received by"}
                </p>
              </div>
            </div>
            <div>
              <div className="w-40 border-t border-line pt-1">
                <p className="font-body text-xs text-muted">
                  For {s?.business_name || "E Tronic"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
