"use client";

import { useState } from "react";
import { createInvoice } from "@/app/admin/actions";

type Line = { name: string; price: string; cost_price: string; qty: string };

export default function NewInvoiceForm() {
  const [lines, setLines] = useState<Line[]>([
    { name: "", price: "", cost_price: "", qty: "1" },
  ]);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { name: "", price: "", cost_price: "", qty: "1" }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const itemsJson = JSON.stringify(
    lines
      .filter((l) => l.name.trim())
      .map((l) => ({
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

  return (
    <form action={createInvoice} className="space-y-6 max-w-2xl">
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
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright mb-2">
          Items
        </legend>

        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                placeholder="Item"
                value={line.name}
                onChange={(e) => updateLine(i, { name: e.target.value })}
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
          + Add line
        </button>
      </fieldset>

      <div className="flex items-center justify-between font-body text-sm border-t border-line pt-4">
        <span className="text-muted">Total</span>
        <span className="font-mono text-copper-bright text-base">
          MVR {subtotal.toFixed(2)}
        </span>
      </div>

      <button
        type="submit"
        className="rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium px-5 py-2.5"
      >
        Create invoice
      </button>
    </form>
  );
}
