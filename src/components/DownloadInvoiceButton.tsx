"use client";

import { useState } from "react";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import type { Invoice, Settings } from "@/lib/types";

export default function DownloadInvoiceButton({
  invoice,
  settings,
}: {
  invoice: Invoice;
  settings: Settings | null;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={async () => {
        setLoading(true);
        try {
          await downloadInvoicePdf(invoice, settings);
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="rounded-md border border-line text-muted hover:text-paper transition-colors font-body text-sm px-4 py-2 disabled:opacity-50 print:hidden"
    >
      {loading ? "Preparing…" : "Download PDF"}
    </button>
  );
}
