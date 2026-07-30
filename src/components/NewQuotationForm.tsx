"use client";

import { useMemo, useState } from "react";
import { createQuotation } from "@/app/admin/actions";
import SubmitButton from "@/components/SubmitButton";
import type { Product } from "@/lib/types";

type Line = {
  name: string;
  price: string;
  cost_price: string;
  qty: string;
  product_id: string | null;
};

const emptyLine = (): Line => ({
  name: "",
  price: "",
  cost_price: "",
  qty: "1",
  product_id: null,
});

export default function NewQuotationForm({ products }: { products: Product[] }) {
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [discountType, setDiscountType] = useState<"none" | "percent" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState("");

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.code && p.code.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [search, products]);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addProduct(product: Product) {
    setLines((prev) => {
      const existingIdx = prev.findIndex((l) => l.product_id === product.id);
      if (existingIdx !== -1) {
        return prev.map((l, idx) =>
          idx === existingIdx ? { ...l, qty: String((parseInt(l.qty, 10) || 0) + 1) } : l
        );
      }
      const blankIdx = prev.findIndex((l) => !l.name.trim());
      const newLine: Line = {
        name: product.name,
        price: String(product.price),
        cost_price: product.cost_price != null ? String(product.cost_price) : "",
        qty: "1",
        product_id: product.id,
      };
      if (blankIdx !== -1) {
        return prev.map((l, idx) => (idx === blankIdx ? newLine : l));
      }
      return [...prev, newLine];
    });
    setSearch("");
    setSearchOpen(false);
  }

  const itemsJson = JSON.stringify(
    lines
      .filter((l) => l.name.trim())
      .map((l) => ({
        product_id: l.product_id,
        name: l.name.trim(),
        price: parseFloat(l.price) || 0,
        cost_price: l.cost_price ? parseFloat(l.cost_price) : null,
        qty: parseInt(l.qty, 10) || 1,
      }))
  );

  const subtotal = lines.reduce(
    (sum, l) => sum + (parseFloat(l.price) || 0) * (parseInt(l.qty, 10) || 0),
    0
  );
  const discountNum = parseFloat(discountValue) || 0;
  const discountAmount =
    discountType === "percent"
      ? (subtotal * discountNum) / 100
      : discountType === "fixed"
      ? discountNum
      : 0;
  const total = Math.max(0, subtotal - discountAmount);

  return (
    <form action={createQuotation} className="space-y-6 max-w-2xl">
      <input type="hidden" name="items" value={itemsJson} />

      <fieldset className="space-y-4">
        <legend className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright mb-2">
          Customer
        </legend>
        <div>
          <label className="block font-body text-xs text-muted mb-1">Name</label>
          <input
            name="customer_name"
            required
            className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-body text-xs text-muted mb-1">Phone</label>
            <input
              name="customer_phone"
              className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
            />
          </div>
          <div>
            <label className="block font-body text-xs text-muted mb-1">Address</label>
            <input
              name="customer_address"
              className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block font-body text-xs text-muted mb-1">
            TIN <span className="text-muted">(optional)</span>
          </label>
          <input
            name="customer_tin"
            className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-mono text-sm text-paper focus:border-copper outline-none"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright mb-2">
          Items
        </legend>

        {products.length > 0 && (
          <div className="relative">
            <label className="block font-body text-xs text-muted mb-1">
              Find a product
            </label>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              placeholder="Type a name or code…"
              className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper placeholder:text-muted/50 focus:border-copper outline-none"
            />
            {searchOpen && matches.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-line bg-surface shadow-lg overflow-hidden">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={() => addProduct(p)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-raised transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="font-body text-sm text-paper block truncate">
                        {p.name}
                      </span>
                      {p.code && (
                        <span className="font-mono text-[10px] text-muted">{p.code}</span>
                      )}
                    </span>
                    <span className="font-mono text-xs text-copper-bright shrink-0">
                      MVR {p.price.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 pt-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                placeholder="Item"
                value={line.name}
                onChange={(e) => updateLine(i, { name: e.target.value, product_id: null })}
                className="col-span-5 rounded-md bg-surface-raised border border-line px-2 py-1.5 font-body text-sm text-paper focus:border-copper outline-none"
              />
              <input
                placeholder="Qty"
                type="number"
                min="1"
                value={line.qty}
                onChange={(e) => updateLine(i, { qty: e.target.value })}
                className="col-span-2 rounded-md bg-surface-raised border border-line px-2 py-1.5 font-mono text-sm text-paper focus:border-copper outline-none"
              />
              <input
                placeholder="Price"
                type="number"
                step="0.01"
                value={line.price}
                onChange={(e) => updateLine(i, { price: e.target.value })}
                className="col-span-2 rounded-md bg-surface-raised border border-line px-2 py-1.5 font-mono text-sm text-paper focus:border-copper outline-none"
              />
              <input
                placeholder="Cost"
                type="number"
                step="0.01"
                value={line.cost_price}
                onChange={(e) => updateLine(i, { cost_price: e.target.value })}
                className="col-span-2 rounded-md bg-surface-raised border border-line px-2 py-1.5 font-mono text-sm text-paper focus:border-copper outline-none"
              />
              <button
                type="button"
                onClick={() => removeLine(i)}
                className="col-span-1 font-mono text-xs text-muted hover:text-copper-bright"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addLine}
          className="font-mono text-xs text-copper-bright hover:text-copper transition-colors"
        >
          + Add custom line
        </button>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright mb-2">
          Discount <span className="text-muted normal-case tracking-normal">(optional)</span>
        </legend>
        <div className="flex gap-3">
          <select
            name="discount_type"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as typeof discountType)}
            className="rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
          >
            <option value="none">No discount</option>
            <option value="percent">Percent off</option>
            <option value="fixed">Fixed amount off</option>
          </select>
          {discountType !== "none" && (
            <input
              name="discount_value"
              type="number"
              step="0.01"
              min="0"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 100"}
              className="w-32 rounded-md bg-surface-raised border border-line px-3 py-2 font-mono text-sm text-paper placeholder:text-muted/50 focus:border-copper outline-none"
            />
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright mb-2">
          Terms <span className="text-muted normal-case tracking-normal">(optional)</span>
        </legend>
        <div>
          <label className="block font-body text-xs text-muted mb-1">Delivery terms</label>
          <input
            name="delivery_terms"
            placeholder="e.g. 5 days from date of confirmation"
            className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper placeholder:text-muted/50 focus:border-copper outline-none"
          />
        </div>
        <div>
          <label className="block font-body text-xs text-muted mb-1">Payment terms</label>
          <input
            name="payment_terms"
            placeholder="e.g. 50% advance, balance before delivery"
            className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper placeholder:text-muted/50 focus:border-copper outline-none"
          />
        </div>
      </fieldset>

      <div className="space-y-1 border-t border-line pt-4">
        <div className="flex items-center justify-between font-body text-sm">
          <span className="text-muted">Subtotal</span>
          <span className="font-mono text-paper">MVR {subtotal.toFixed(2)}</span>
        </div>
        {discountType !== "none" && discountAmount > 0 && (
          <div className="flex items-center justify-between font-body text-sm">
            <span className="text-muted">Discount</span>
            <span className="font-mono text-copper-bright">
              − MVR {discountAmount.toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between font-body text-sm pt-1">
          <span className="text-muted">Grand total</span>
          <span className="font-mono text-copper-bright text-base">
            MVR {total.toFixed(2)}
          </span>
        </div>
      </div>

      <SubmitButton
        pendingText="Creating…"
        className="rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium px-5 py-2.5"
      >
        Create quotation
      </SubmitButton>
    </form>
  );
}
