"use client";

import { deleteOrder } from "@/app/admin/actions";

export default function DeleteOrderButton({
  id,
  customerName,
}: {
  id: string;
  customerName: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm(`Remove ${customerName}'s order? This can't be undone.`)) {
          deleteOrder(id);
        }
      }}
      className="font-mono text-xs text-muted hover:text-copper-bright transition-colors"
    >
      Remove
    </button>
  );
}
