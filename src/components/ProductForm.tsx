"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { generateProductCard } from "@/lib/card-generator";
import SubmitButton from "@/components/SubmitButton";

export default function ProductForm({
  product,
  action,
}: {
  product?: Product;
  action: (formData: FormData) => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const hiddenImageRef = useRef<HTMLInputElement>(null);

  const [rawFile, setRawFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(product?.image_url ?? null);
  const [cardReady, setCardReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRawFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setRawFile(file);
    setCardReady(false);
    setError(null);
    if (hiddenImageRef.current) hiddenImageRef.current.value = "";
    setPreview(file ? URL.createObjectURL(file) : product?.image_url ?? null);
  }

  async function handleGenerateCard() {
    if (!rawFile) return;
    const name = nameRef.current?.value?.trim();
    const price = priceRef.current?.value ?? "0";
    if (!name) {
      setError("Add the item name before generating the card.");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const blob = await generateProductCard({ file: rawFile, name, price });
      const generatedFile = new File([blob], "product-card.jpg", {
        type: "image/jpeg",
      });

      const dt = new DataTransfer();
      dt.items.add(generatedFile);
      if (hiddenImageRef.current) hiddenImageRef.current.files = dt.files;

      setPreview(URL.createObjectURL(generatedFile));
      setCardReady(true);
    } catch {
      setError("Couldn't generate the card — try a different photo.");
    } finally {
      setGenerating(false);
    }
  }

  const needsCard = rawFile && !cardReady;

  return (
    <form action={action} className="space-y-5 max-w-lg">
      <div>
        <label className="block font-body text-xs text-muted mb-1" htmlFor="name">
          Item name
        </label>
        <input
          id="name"
          name="name"
          ref={nameRef}
          required
          defaultValue={product?.name}
          onChange={() => setCardReady(false)}
          className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
        />
      </div>

      <div>
        <label className="block font-body text-xs text-muted mb-1" htmlFor="caption">
          Short description <span className="text-muted">(optional)</span>
        </label>
        <textarea
          id="caption"
          name="caption"
          rows={3}
          defaultValue={product?.caption ?? ""}
          className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-body text-xs text-muted mb-1" htmlFor="price">
            Selling price (MVR)
          </label>
          <input
            id="price"
            name="price"
            ref={priceRef}
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={product?.price}
            onChange={() => setCardReady(false)}
            className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-mono text-sm text-paper focus:border-copper outline-none"
          />
        </div>
        <div>
          <label className="block font-body text-xs text-muted mb-1" htmlFor="cost_price">
            Your cost price <span className="text-muted">(private)</span>
          </label>
          <input
            id="cost_price"
            name="cost_price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product?.cost_price ?? ""}
            className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-mono text-sm text-paper focus:border-copper outline-none"
          />
          <p className="font-body text-[11px] text-muted mt-1">
            Used for your profit reports only — never shown to customers.
          </p>
        </div>
      </div>

      <div>
        <label className="block font-body text-xs text-muted mb-1" htmlFor="rawImage">
          Photo {product ? "(leave empty to keep current)" : ""}
        </label>
        <input
          id="rawImage"
          type="file"
          accept="image/*"
          onChange={handleRawFileChange}
          className="w-full font-body text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-copper file:text-ink file:text-xs file:font-medium file:px-3 file:py-2"
        />
        {/* the actual file that gets submitted — filled by the raw picker
            above (on edit, unchanged) or replaced with the generated card */}
        <input ref={hiddenImageRef} type="file" name="image" className="hidden" />

        {preview && (
          <div className="relative w-40 h-40 mt-3 rounded-md overflow-hidden border border-line">
            <Image src={preview} alt="Preview" fill className="object-cover" />
            {cardReady && (
              <span className="absolute bottom-1 left-1 font-mono text-[9px] uppercase tracking-wide bg-copper text-ink px-1.5 py-0.5 rounded-sm">
                Card ready
              </span>
            )}
          </div>
        )}

        {rawFile && (
          <button
            type="button"
            onClick={handleGenerateCard}
            disabled={generating}
            className="mt-3 rounded-md border border-copper/60 text-copper-bright hover:bg-copper hover:text-ink transition-colors font-body text-xs font-medium px-4 py-2 disabled:opacity-50"
          >
            {generating
              ? "Generating…"
              : cardReady
              ? "Regenerate card"
              : "Generate branded card"}
          </button>
        )}
        {error && (
          <p className="font-body text-xs text-copper-bright mt-2">{error}</p>
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

      {needsCard && (
        <p className="font-body text-xs text-muted">
          Generate the branded card above before {product ? "saving" : "adding"}
          , so the photo posted matches the rest of the site.
        </p>
      )}

      <SubmitButton
        disabled={!!needsCard}
        pendingText={product ? "Saving…" : "Adding…"}
        className="rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {product ? "Save changes" : "Add product"}
      </SubmitButton>
    </form>
  );
}
