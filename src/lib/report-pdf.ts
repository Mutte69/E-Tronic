"use client";

import { jsPDF } from "jspdf";
import type { Report } from "@/lib/reports";
import type { Settings } from "@/lib/types";

const COPPER: [number, number, number] = [198, 121, 61];
const INK: [number, number, number] = [30, 28, 26];
const MUTED: [number, number, number] = [130, 126, 118];
const HAIRLINE: [number, number, number] = [230, 226, 218];
const ZEBRA: [number, number, number] = [250, 248, 244];

function loadImageAsDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

export async function downloadReportPdf(
  report: Report,
  settings: Settings | null,
  title: string
) {
  const logo = await loadImageAsDataUrl("/etronic-logo-black.png").catch(() => null);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  if (logo) {
    const logoW = 110;
    const logoH = logoW * (332 / 1155);
    doc.addImage(logo, "PNG", margin, y, logoW, logoH);
    y += logoH + 16;
  } else {
    y += 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(title, margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(report.label, margin, y);
  y += 24;

  doc.setDrawColor(...HAIRLINE);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  // Summary cards
  const cardW = (pageWidth - margin * 2 - 20) / 3;
  const margin_pct = report.sales > 0 ? (report.profit / report.sales) * 100 : 0;
  const cards = [
    { label: "SALES", value: `MVR ${report.sales.toFixed(2)}` },
    { label: "PROFIT", value: `MVR ${report.profit.toFixed(2)}` },
    { label: "MARGIN", value: `${margin_pct.toFixed(1)}%` },
  ];
  cards.forEach((c, i) => {
    const cx = margin + i * (cardW + 10);
    doc.setDrawColor(...HAIRLINE);
    doc.rect(cx, y, cardW, 50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(c.label, cx + 10, y + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...COPPER);
    doc.text(c.value, cx + 10, y + 38);
  });
  y += 74;

  // Table
  const col = { date: margin, customer: margin + 70, items: margin + 190, sales: pageWidth - margin - 80, profit: pageWidth - margin };

  doc.setFillColor(...INK);
  doc.rect(margin, y, pageWidth - margin * 2, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("DATE", col.date + 8, y + 15);
  doc.text("CUSTOMER", col.customer, y + 15);
  doc.text("ITEMS", col.items, y + 15);
  doc.text("SALES", col.sales, y + 15, { align: "right" });
  doc.text("PROFIT", col.profit - 8, y + 15, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  if (report.rows.length === 0) {
    doc.setTextColor(...MUTED);
    doc.text("No paid invoices in this period.", margin + 8, y + 18);
    y += 30;
  }

  report.rows.forEach((row, i) => {
    if (y > pageHeight - 100) {
      doc.addPage();
      y = margin;
    }
    const rowH = 22;
    if (i % 2 === 1) {
      doc.setFillColor(...ZEBRA);
      doc.rect(margin, y, pageWidth - margin * 2, rowH, "F");
    }
    const textY = y + 15;
    doc.setTextColor(...INK);
    doc.text(row.date, col.date + 8, textY);
    doc.text(row.customer_name, col.customer, textY, { maxWidth: 110 });
    doc.setTextColor(...MUTED);
    doc.text(row.items, col.items, textY, { maxWidth: pageWidth - margin - col.items - 100 });
    doc.setTextColor(...INK);
    doc.text(row.sales.toFixed(2), col.sales, textY, { align: "right" });
    doc.setTextColor(...COPPER);
    doc.text(row.profit.toFixed(2), col.profit - 8, textY, { align: "right" });
    y += rowH;
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `${settings?.business_name ?? "E Tronic"} — generated ${new Date().toLocaleString()}`,
    margin,
    pageHeight - 30
  );

  doc.save(`etronic-report-${report.filenamePart}.pdf`);
}
