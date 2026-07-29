"use client";

import { useState } from "react";
import { buildDailyReport, buildMonthlyReport } from "@/lib/reports";
import { downloadReportPdf } from "@/lib/report-pdf";
import { downloadReportXlsx } from "@/lib/report-xlsx";
import type { Invoice, Settings } from "@/lib/types";

export default function ReportDownloads({
  invoices,
  settings,
}: {
  invoices: Invoice[];
  settings: Settings | null;
}) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handle(kind: "daily" | "monthly", format: "pdf" | "xlsx") {
    const key = `${kind}-${format}`;
    setLoading(key);
    try {
      const report =
        kind === "daily" ? buildDailyReport(invoices) : buildMonthlyReport(invoices);
      const title = kind === "daily" ? "Daily Sales Report" : "Monthly Sales Report";
      if (format === "pdf") {
        await downloadReportPdf(report, settings, title);
      } else {
        downloadReportXlsx(report, title);
      }
    } finally {
      setLoading(null);
    }
  }

  const Btn = ({
    kind,
    format,
    children,
  }: {
    kind: "daily" | "monthly";
    format: "pdf" | "xlsx";
    children: React.ReactNode;
  }) => {
    const key = `${kind}-${format}`;
    return (
      <button
        onClick={() => handle(kind, format)}
        disabled={loading === key}
        className="rounded-md border border-line text-muted hover:text-paper hover:border-copper/50 transition-colors font-mono text-xs px-3 py-2 disabled:opacity-50"
      >
        {loading === key ? "Preparing…" : children}
      </button>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="border border-line rounded-lg bg-surface p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-3">
          Daily report (today)
        </p>
        <div className="flex gap-2">
          <Btn kind="daily" format="pdf">
            Download PDF
          </Btn>
          <Btn kind="daily" format="xlsx">
            Download Excel
          </Btn>
        </div>
      </div>
      <div className="border border-line rounded-lg bg-surface p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-3">
          Monthly report (this month)
        </p>
        <div className="flex gap-2">
          <Btn kind="monthly" format="pdf">
            Download PDF
          </Btn>
          <Btn kind="monthly" format="xlsx">
            Download Excel
          </Btn>
        </div>
      </div>
    </div>
  );
}
