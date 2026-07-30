"use client";

import { jsPDF } from "jspdf";
import type { DeliveryNote, Settings } from "@/lib/types";

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

export async function downloadDeliveryNotePdf(note: DeliveryNote, settings: Settings | null) {
  const logo = await loadImageAsDataUrl("/etronic-logo-black.png").catch(() => null);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
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
  doc.text("DELIVERY NOTE", pageWidth - margin, margin + 8, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`DN-${note.delivery_no}`, pageWidth - margin, margin + 28, { align: "right" });
  doc.text(
    new Date(note.created_at).toLocaleDateString(),
    pageWidth - margin,
    margin + 42,
    { align: "right" }
  );

  y = Math.max(y, margin + 90);
  y += 14;

  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("DELIVER TO", margin, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(note.customer_name, margin, y);
  y += 15;

  doc.setFont("helvetica", "normal");
  if (note.customer_phone) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(note.customer_phone, margin, y);
    y += 13;
  }
  if (note.customer_address) {
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(note.customer_address, margin, y, { maxWidth: 300 });
    y += 20;
  }

  y += 10;

  doc.setFillColor(...INK);
  doc.rect(margin, y, pageWidth - margin * 2, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("ITEM", margin + 10, y + 16);
  doc.text("QTY", pageWidth - margin - 10, y + 16, { align: "right" });
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  note.items.forEach((item, i) => {
    const rowH = 24;
    if (i % 2 === 1) {
      doc.setFillColor(...ZEBRA);
      doc.rect(margin, y, pageWidth - margin * 2, rowH, "F");
    }
    const textY = y + 16;
    doc.setTextColor(...INK);
    doc.text(item.name, margin + 10, textY, { maxWidth: pageWidth - margin * 2 - 100 });
    doc.text(String(item.qty), pageWidth - margin - 10, textY, { align: "right" });
    y += rowH;
  });

  y += 20;
  if (note.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`Notes: ${note.notes}`, margin, y, { maxWidth: pageWidth - margin * 2 });
    y += 20;
  }

  // signature lines
  const sigY = Math.max(y + 40, pageHeight - 120);
  doc.setDrawColor(...HAIRLINE);
  doc.line(margin, sigY, margin + 180, sigY);
  doc.line(pageWidth - margin - 180, sigY, pageWidth - margin, sigY);

  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(note.received_by || "Received by", margin, sigY + 14);
  doc.text(`For ${settings?.business_name || "E Tronic"}`, pageWidth - margin - 180, sigY + 14);

  doc.save(`etronic-delivery-note-${note.delivery_no}.pdf`);
}
