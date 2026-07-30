"use client";

import { useState } from "react";
import { downloadDeliveryNotePdf } from "@/lib/delivery-note-pdf";
import type { DeliveryNote, Settings } from "@/lib/types";

export default function DownloadDeliveryNoteButton({
  note,
  settings,
}: {
  note: DeliveryNote;
  settings: Settings | null;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      onClick={async () => {
        setLoading(true);
        try {
          await downloadDeliveryNotePdf(note, settings);
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
