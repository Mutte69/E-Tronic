"use client";

import * as XLSX from "xlsx";
import type { Report } from "@/lib/reports";

export function downloadReportXlsx(report: Report, title: string) {
  const margin = report.sales > 0 ? (report.profit / report.sales) * 100 : 0;

  const summarySheet = XLSX.utils.aoa_to_sheet([
    [title],
    [report.label],
    [],
    ["Sales (MVR)", report.sales.toFixed(2)],
    ["Discounts given (MVR)", report.discount.toFixed(2)],
    ["Profit (MVR)", report.profit.toFixed(2)],
    ["Margin (%)", margin.toFixed(1)],
    ["Invoices", report.rows.length],
  ]);
  summarySheet["!cols"] = [{ wch: 18 }, { wch: 18 }];

  const detailRows = report.rows.map((r) => ({
    "Invoice #": r.invoice_no,
    Date: r.date,
    Customer: r.customer_name,
    Items: r.items,
    "Sales (MVR)": r.sales,
    "Discount (MVR)": r.discount,
    "Profit (MVR)": r.profit,
  }));
  const detailSheet = XLSX.utils.json_to_sheet(detailRows);
  detailSheet["!cols"] = [
    { wch: 10 },
    { wch: 12 },
    { wch: 20 },
    { wch: 40 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(wb, detailSheet, "Invoices");

  XLSX.writeFile(wb, `etronic-report-${report.filenamePart}.xlsx`);
}
