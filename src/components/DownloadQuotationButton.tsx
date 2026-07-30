"use client";

import { useState } from "react";
import { downloadQuotationPdf } from "@/lib/quotation-pdf";
import type { Quotation, Settings } from "@/lib/types";

export default function DownloadQuotationButton({
  quotation,
  settings,
}: {
  quotation: Quotation;
  settings: Settings | null;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={async () => {
        setLoading(true);
        try {
          await downloadQuotationPdf(quotation, settings);
        } finally {
          setLoading(false);
        }
      }}
      disabled={loading}
      className="rounded-md border border-line text-muted hover:text-paper transition-colors font-body text-sm px-4 py-2 disabled:opacity-50"
    >
      {loading ? "Preparing…" : "Download PDF"}
    </button>
  );
}
