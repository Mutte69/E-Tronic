import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import { normalizeDeliveryNotes } from "@/lib/normalize";
import type { DeliveryNote } from "@/lib/types";

export const revalidate = 0;

export default async function DeliveryNotesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("delivery_notes")
    .select("*")
    .order("created_at", { ascending: false });

  const notes = normalizeDeliveryNotes((data ?? []) as DeliveryNote[]);

  return (
    <div className="min-h-screen">
      <AdminNav active="/admin/delivery-notes" />
      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <h1 className="font-display text-2xl mb-6">Delivery notes</h1>

        {notes.length === 0 ? (
          <p className="font-body text-muted text-sm">
            No delivery notes yet — create one from an invoice's page once
            goods are handed over.
          </p>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <Link
                key={n.id}
                href={`/admin/delivery-notes/${n.id}`}
                className="flex items-center justify-between border border-line rounded-lg bg-surface p-4 hover:border-copper/50 transition-colors"
              >
                <div>
                  <p className="font-mono text-xs text-muted">DN-{n.delivery_no}</p>
                  <p className="font-body text-sm text-paper">{n.customer_name}</p>
                </div>
                <p className="font-mono text-xs text-muted">
                  {new Date(n.created_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
