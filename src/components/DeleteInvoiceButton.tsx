"use client";

import { deleteInvoice } from "@/app/admin/actions";

export default function DeleteInvoiceButton({
  id,
  invoiceNo,
  className,
}: {
  id: string;
  invoiceNo: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm(`Delete invoice #${invoiceNo}? This can't be undone.`)) {
          deleteInvoice(id);
        }
      }}
      className={
        className ??
        "font-mono text-xs text-muted hover:text-copper-bright transition-colors"
      }
    >
      Delete
    </button>
  );
}
