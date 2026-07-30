import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "@/components/AdminNav";
import { normalizeQuotations } from "@/lib/normalize";
import type { Quotation } from "@/lib/types";

export const revalidate = 0;

export default async function QuotationsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("quotations")
    .select("*")
    .order("created_at", { ascending: false });

  const quotations = normalizeQuotations((data ?? []) as Quotation[]);

  return (
    <div className="min-h-screen">
      <AdminNav active="/admin/quotations" />
      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl">Quotations</h1>
          <Link
            href="/admin/quotations/new"
            className="rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium px-4 py-2"
          >
            + New quotation
          </Link>
        </div>

        {quotations.length === 0 ? (
          <p className="font-body text-muted text-sm">No quotations yet.</p>
        ) : (
          <div className="space-y-2">
            {quotations.map((q) => (
              <Link
                key={q.id}
                href={`/admin/quotations/${q.id}`}
                className="flex items-center justify-between border border-line rounded-lg bg-surface p-4 hover:border-copper/50 transition-colors"
              >
                <div>
                  <p className="font-mono text-xs text-muted">Quote-{q.quotation_no}</p>
                  <p className="font-body text-sm text-paper">{q.customer_name}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm text-copper-bright">
                    MVR {q.total.toFixed(2)}
                  </span>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-wide px-2 py-1 rounded-sm border ${
                      q.status === "converted"
                        ? "border-copper text-copper-bright"
                        : "border-line text-muted"
                    }`}
                  >
                    {q.status === "converted" ? "invoiced" : "open"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
