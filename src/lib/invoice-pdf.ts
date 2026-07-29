"use client";

import { jsPDF } from "jspdf";
import type { Invoice, Settings } from "@/lib/types";

const COPPER: [number, number, number] = [198, 121, 61];
const INK: [number, number, number] = [30, 28, 26];
const MUTED: [number, number, number] = [130, 126, 118];
const HAIRLINE: [number, number, number] = [230, 226, 218];
const ZEBRA: [number, number, number] = [250, 248, 244];

const TERMS =
  "Payment is due upon receipt of this invoice unless otherwise agreed. For bank transfers, please use the invoice number as the payment reference. Items are covered under the relevant manufacturer's warranty where applicable; E Tronic is not liable for damage caused by misuse, unauthorised repair, or normal wear. Please retain this invoice as proof of purchase for any service or warranty claim.";

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
  const logo = await loadImageAsDataUrl("/etronic-logo-black.png").catch(() => null);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  // Logo, top-left
  if (logo) {
    const logoW = 130;
    const logoH = logoW * (332 / 1155);
    doc.addImage(logo, "PNG", margin, y, logoW, logoH);
    y += logoH + 14;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...INK);
    doc.text("E tronic", margin, y + 20);
    y += 34;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  if (settings?.registration_number) {
    doc.text(`Reg. No. ${settings.registration_number}`, margin, y);
    y += 12;
  }
  if (settings?.address) {
    doc.text(settings.address, margin, y);
    y += 12;
  }
  if (settings?.phone) {
    doc.text(settings.phone, margin, y);
    y += 12;
  }

  // Invoice meta, top-right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text("INVOICE", pageWidth - margin, margin + 8, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`#${invoice.invoice_no}`, pageWidth - margin, margin + 28, { align: "right" });
  doc.text(
    new Date(invoice.created_at).toLocaleDateString(),
    pageWidth - margin,
    margin + 42,
    { align: "right" }
  );
  if (invoice.status === "paid" && invoice.paid_at) {
    doc.setTextColor(...COPPER);
    doc.text(
      `Paid ${new Date(invoice.paid_at).toLocaleDateString()}`,
      pageWidth - margin,
      margin + 56,
      { align: "right" }
    );
  }

  y = Math.max(y, margin + 90);
  y += 14;

  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 26;

  // Bill to
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("BILL TO", margin, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(invoice.customer_name, margin, y);
  y += 15;

  doc.setFont("helvetica", "normal");
  if (invoice.customer_phone) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(invoice.customer_phone, margin, y);
    y += 13;
  }
  if (invoice.customer_address) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(invoice.customer_address, margin, y, { maxWidth: 260 });
    y += 20;
  }

  y += 10;

  // Table
  const col = {
    item: margin,
    qty: pageWidth - margin - 200,
    price: pageWidth - margin - 130,
    total: pageWidth - margin,
  };

  doc.setFillColor(...INK);
  doc.rect(margin, y, pageWidth - margin * 2, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("ITEM", col.item + 10, y + 16);
  doc.text("QTY", col.qty, y + 16, { align: "right" });
  doc.text("PRICE", col.price, y + 16, { align: "right" });
  doc.text("TOTAL", col.total - 10, y + 16, { align: "right" });
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  invoice.items.forEach((item, i) => {
    const rowH = 26;
    if (i % 2 === 1) {
      doc.setFillColor(...ZEBRA);
      doc.rect(margin, y, pageWidth - margin * 2, rowH, "F");
    }
    const textY = y + 17;
    doc.setTextColor(...INK);
    doc.text(item.name, col.item + 10, textY, { maxWidth: col.qty - margin - 30 });
    doc.setTextColor(...MUTED);
    doc.text(String(item.qty), col.qty, textY, { align: "right" });
    doc.text(item.price.toFixed(2), col.price, textY, { align: "right" });
    doc.setTextColor(...INK);
    doc.text((item.price * item.qty).toFixed(2), col.total - 10, textY, { align: "right" });
    y += rowH;
  });

  doc.setDrawColor(...HAIRLINE);
  doc.line(margin, y, pageWidth - margin, y);
  y += 24;

  // Totals
  const hasDiscount = invoice.discount_type !== "none" && invoice.subtotal !== invoice.total;
  if (hasDiscount) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Subtotal", col.price, y, { align: "right" });
    doc.setTextColor(...INK);
    doc.text(`MVR ${invoice.subtotal.toFixed(2)}`, col.total - 10, y, { align: "right" });
    y += 15;

    const discountLabel =
      invoice.discount_type === "percent"
        ? `Discount (${invoice.discount_value}%)`
        : "Discount";
    doc.setTextColor(...MUTED);
    doc.text(discountLabel, col.price, y, { align: "right" });
    doc.setTextColor(...COPPER);
    doc.text(
      `− MVR ${(invoice.subtotal - invoice.total).toFixed(2)}`,
      col.total - 10,
      y,
      { align: "right" }
    );
    y += 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("TOTAL DUE", col.price, y, { align: "right" });
  doc.setFontSize(16);
  doc.setTextColor(...COPPER);
  doc.text(`MVR ${invoice.total.toFixed(2)}`, col.total - 10, y, { align: "right" });

  // PAID stamp
  if (invoice.status === "paid") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(34);
    doc.setTextColor(...COPPER);
    doc.text("PAID", pageWidth - margin - 100, margin + 110, { angle: 18 });
  }

  y += 40;

  // Terms & Conditions
  doc.setDrawColor(...HAIRLINE);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("TERMS & CONDITIONS", margin, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const termsLines = doc.splitTextToSize(TERMS, pageWidth - margin * 2);
  doc.text(termsLines, margin, y);
  y += termsLines.length * 11 + 20;

  // Payment details
  const hasBank = settings?.bml_account_number || settings?.mib_account_number;
  if (hasBank) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("PAYMENT DETAILS", margin, y);
    y += 16;

    if (settings?.bml_account_number) {
      const label = `BML${settings.bml_account_name ? ` — ${settings.bml_account_name}` : ""}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(label, margin, y);
      const labelW = doc.getTextWidth(label);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text(settings.bml_account_number, margin + labelW + 14, y);
      y += 15;
    }
    if (settings?.mib_account_number) {
      const label = `MIB${settings.mib_account_name ? ` — ${settings.mib_account_name}` : ""}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(label, margin, y);
      const labelW = doc.getTextWidth(label);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text(settings.mib_account_number, margin + labelW + 14, y);
      y += 15;
    }
    y += 20;
  }

  // Signature / prepared-by footer
  doc.setDrawColor(...HAIRLINE);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `Prepared by: ${settings?.invoice_prepared_by || "E Tronic Sales Team"}`,
    margin,
    y
  );
  doc.text(`For ${settings?.business_name || "E Tronic"}`, pageWidth - margin, y, {
    align: "right",
  });
  y += 20;
  doc.setFont("helvetica", "italic");
  doc.text("Thank you for your business.", margin, y);

  doc.save(`etronic-invoice-${invoice.invoice_no}.pdf`);
}
