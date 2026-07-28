"use client";

import { useState } from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";

export default function ProductForm({
  product,
  action,
}: {
  product?: Product;
  action: (formData: FormData) => void;
}) {
  const [preview, setPreview] = useState<string | null>(
    product?.image_url ?? null
  );

  return (
    <form action={action} className="space-y-5 max-w-lg">
      <div>
        <label className="block font-body text-xs text-muted mb-1" htmlFor="name">
          Item name
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={product?.name}
          className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
        />
      </div>

      <div>
        <label className="block font-body text-xs text-muted mb-1" htmlFor="caption">
          Short description
        </label>
        <textarea
          id="caption"
          name="caption"
          rows={3}
          defaultValue={product?.caption ?? ""}
          className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
        />
      </div>

      <div>
        <label className="block font-body text-xs text-muted mb-1" htmlFor="price">
          Price (MVR)
        </label>
        <input
          id="price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={product?.price}
          className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-mono text-sm text-paper focus:border-copper outline-none"
        />
      </div>

      <div>
        <label className="block font-body text-xs text-muted mb-1" htmlFor="image">
          Photo {product ? "(leave empty to keep current)" : ""}
        </label>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setPreview(URL.createObjectURL(file));
          }}
          className="w-full font-body text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-copper file:text-ink file:text-xs file:font-medium file:px-3 file:py-2"
        />
        {preview && (
          <div className="relative w-24 h-24 mt-3 rounded-md overflow-hidden border border-line">
            <Image src={preview} alt="Preview" fill className="object-cover" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 font-body text-sm text-paper">
          <input
            type="checkbox"
            name="featured"
            defaultChecked={product?.featured}
            className="accent-copper"
          />
          Show as featured
        </label>
        <label className="flex items-center gap-2 font-body text-sm text-paper">
          <input
            type="checkbox"
            name="in_stock"
            defaultChecked={product?.in_stock ?? true}
            className="accent-copper"
          />
          In stock
        </label>
      </div>

      <button
        type="submit"
        className="rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium px-5 py-2.5"
      >
        {product ? "Save changes" : "Add product"}
      </button>
    </form>
  );
}
