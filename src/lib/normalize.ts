import type { Invoice } from "@/lib/types";

/**
 * Fills in safe defaults for columns that may not exist yet on an
 * older/un-migrated database (total, discount_type, discount_value),
 * so a missed `schema.sql` re-run degrades gracefully instead of
 * crashing the page.
 */
export function normalizeInvoice(raw: Invoice): Invoice {
  return {
    ...raw,
    total: raw.total ?? raw.subtotal,
    discount_type: raw.discount_type ?? "none",
    discount_value: raw.discount_value ?? 0,
  };
}

export function normalizeInvoices(rows: Invoice[]): Invoice[] {
  return rows.map(normalizeInvoice);
}
