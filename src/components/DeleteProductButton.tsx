"use client";

import { deleteProduct } from "@/app/admin/actions";

export default function DeleteProductButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  return (
    <button
      onClick={() => {
        if (confirm(`Remove "${name}"? This can't be undone.`)) {
          deleteProduct(id);
        }
      }}
      className="font-mono text-xs text-muted hover:text-copper-bright transition-colors"
    >
      Remove
    </button>
  );
}
