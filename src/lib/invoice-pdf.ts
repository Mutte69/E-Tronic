"use client";

import { jsPDF } from "jspdf";
import type { Invoice, Settings } from "@/lib/types";

const COPPER: [number, number, number] = [198, 121, 61];
const INK: [number, number, number] = [30, 28, 26];
const MUTED: [number, number, number] = [130, 126, 118];

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

export async function downloadInvoicePdf(invoice: Invoice, settings: Settings | null) {
  const logo = await loadImageAsDataUrl("/etronic-logo.png").catch(() => null);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  // Logo, top-left
  if (logo) {
    const logoW = 130;
    const logoH = logoW * (332 / 1155); // matches the cropped asset's aspect ratio
    doc.addImage(logo, "PNG", margin, y, logoW, logoH);
    y += logoH + 20;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...INK);
    doc.text("E tronic", margin, y + 20);
    y += 40;
  }

  if (settings?.address) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(settings.address, margin, y);
    y += 14;
  }
  if (settings?.phone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(settings.phone, margin, y);
    y += 14;
  }

  // Invoice meta, top-right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text("INVOICE", pageWidth - margin, margin + 8, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`#${invoice.invoice_no}`, pageWidth - margin, margin + 26, { align: "right" });
  doc.text(
    new Date(invoice.created_at).toLocaleDateString(),
    pageWidth - margin,
    margin + 40,
    { align: "right" }
  );

  y = Math.max(y, margin + 70);
  y += 20;

  // Bill to
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("BILL TO", margin, y);
  y += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(invoice.customer_name, margin, y);
  y += 15;

  if (invoice.customer_phone) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(invoice.customer_phone, margin, y);
    y += 13;
  }
  if (invoice.customer_address) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(invoice.customer_address, margin, y, { maxWidth: pageWidth - margin * 2 });
    y += 20;
  }

  y += 15;

  // Table header
  const col = {
    item: margin,
    qty: pageWidth - margin - 200,
    price: pageWidth - margin - 130,
    total: pageWidth - margin,
  };

  doc.setDrawColor(...COPPER);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("ITEM", col.item, y);
  doc.text("QTY", col.qty, y, { align: "right" });
  doc.text("PRICE", col.price, y, { align: "right" });
  doc.text("TOTAL", col.total, y, { align: "right" });
  y += 8;

  doc.setDrawColor(230, 226, 218);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const item of invoice.items) {
    doc.setTextColor(...INK);
    doc.text(item.name, col.item, y, { maxWidth: col.qty - margin - 20 });
    doc.setTextColor(...MUTED);
    doc.text(String(item.qty), col.qty, y, { align: "right" });
    doc.text(item.price.toFixed(2), col.price, y, { align: "right" });
    doc.setTextColor(...INK);
    doc.text((item.price * item.qty).toFixed(2), col.total, y, { align: "right" });
    y += 20;
  }

  y += 6;
  doc.setDrawColor(230, 226, 218);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("TOTAL", col.price, y, { align: "right" });
  doc.setFontSize(14);
  doc.setTextColor(...COPPER);
  doc.text(`MVR ${invoice.subtotal.toFixed(2)}`, col.total, y, { align: "right" });

  // PAID stamp
  if (invoice.status === "paid") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    doc.setTextColor(...COPPER);
    doc.text("PAID", pageWidth - margin - 90, margin + 100, { angle: 18 });
  }

  doc.save(`etronic-invoice-${invoice.invoice_no}.pdf`);
}
