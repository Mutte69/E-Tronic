"use client";

import { jsPDF } from "jspdf";
import type { Quotation, Settings } from "@/lib/types";

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

export async function downloadQuotationPdf(quotation: Quotation, settings: Settings | null) {
  const logo = await loadImageAsDataUrl("/etronic-logo-black.png").catch(() => null);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  if (logo) {
    const logoW = 130;
    const logoH = logoW * (332 / 1155);
    doc.addImage(logo, "PNG", margin, y, logoW, logoH);
    y += logoH + 14;
  } else {
    y += 20;
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...INK);
  doc.text("QUOTATION", pageWidth - margin, margin + 8, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`Quote-${quotation.quotation_no}`, pageWidth - margin, margin + 28, { align: "right" });
  doc.text(
    new Date(quotation.created_at).toLocaleDateString(),
    pageWidth - margin,
    margin + 42,
    { align: "right" }
  );
  if (quotation.valid_until) {
    doc.setTextColor(...COPPER);
    doc.text(
      `Valid until ${new Date(quotation.valid_until).toLocaleDateString()}`,
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

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("QUOTED TO", margin, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(quotation.customer_name, margin, y);
  y += 15;

  doc.setFont("helvetica", "normal");
  if (quotation.customer_phone) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(quotation.customer_phone, margin, y);
    y += 13;
  }
  if (quotation.customer_address) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(quotation.customer_address, margin, y, { maxWidth: 260 });
    y += 15;
  }
  if (quotation.customer_tin) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`TIN: ${quotation.customer_tin}`, margin, y);
    y += 15;
  }

  y += 10;

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
  quotation.items.forEach((item, i) => {
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

  const hasDiscount =
    quotation.discount_type !== "none" && quotation.subtotal !== quotation.total;
  if (hasDiscount) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text("Subtotal", col.price, y, { align: "right" });
    doc.setTextColor(...INK);
    doc.text(`MVR ${quotation.subtotal.toFixed(2)}`, col.total - 10, y, { align: "right" });
    y += 15;

    const discountLabel =
      quotation.discount_type === "percent"
        ? `Discount (${quotation.discount_value}%)`
        : "Discount";
    doc.setTextColor(...MUTED);
    doc.text(discountLabel, col.price, y, { align: "right" });
    doc.setTextColor(...COPPER);
    doc.text(
      `− MVR ${(quotation.subtotal - quotation.total).toFixed(2)}`,
      col.total - 10,
      y,
      { align: "right" }
    );
    y += 20;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text("GRAND TOTAL", col.price, y, { align: "right" });
  doc.setFontSize(16);
  doc.setTextColor(...COPPER);
  doc.text(`MVR ${quotation.total.toFixed(2)}`, col.total - 10, y, { align: "right" });
  y += 34;

  if (quotation.delivery_terms) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text("Delivery:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(quotation.delivery_terms, margin + 55, y, { maxWidth: pageWidth - margin * 2 - 55 });
    y += 16;
  }
  if (quotation.payment_terms) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text("Payment:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    doc.text(quotation.payment_terms, margin + 55, y, { maxWidth: pageWidth - margin * 2 - 55 });
    y += 20;
  }

  y += 10;
  doc.setDrawColor(...HAIRLINE);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  if (settings?.bml_account_number || settings?.mib_account_number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("PAYMENT DETAILS", margin, y);
    y += 15;
    if (settings?.bml_account_number) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(
        `BML ${settings.bml_account_name ?? ""} — ${settings.bml_account_number}`,
        margin,
        y
      );
      y += 14;
    }
    if (settings?.mib_account_number) {
      doc.text(
        `MIB ${settings.mib_account_name ?? ""} — ${settings.mib_account_number}`,
        margin,
        y
      );
      y += 14;
    }
  }

  y += 24;
  doc.setDrawColor(...HAIRLINE);
  doc.line(margin, y, pageWidth - margin, y);
  y += 16;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(
    "This is a computer-generated quotation. No signature is required.",
    margin,
    y
  );

  doc.save(`etronic-quote-${quotation.quotation_no}.pdf`);
}
