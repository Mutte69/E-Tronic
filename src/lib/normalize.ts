import type { Invoice, Quotation, DeliveryNote } from "@/lib/types";

/**
 * Fills in safe defaults for columns that may not exist yet on an
 * older/un-migrated database, so a missed `schema.sql` re-run degrades
 * gracefully instead of crashing the page.
 */
export function normalizeInvoice(raw: Invoice): Invoice {
  return {
    ...raw,
    total: raw.total ?? raw.subtotal,
    discount_type: raw.discount_type ?? "none",
    discount_value: raw.discount_value ?? 0,
    customer_tin: raw.customer_tin ?? null,
    quotation_id: raw.quotation_id ?? null,
  };
}

export function normalizeInvoices(rows: Invoice[]): Invoice[] {
  return rows.map(normalizeInvoice);
}

export function normalizeQuotation(raw: Quotation): Quotation {
  return {
    ...raw,
    total: raw.total ?? raw.subtotal,
    discount_type: raw.discount_type ?? "none",
    discount_value: raw.discount_value ?? 0,
    customer_tin: raw.customer_tin ?? null,
    delivery_terms: raw.delivery_terms ?? null,
    payment_terms: raw.payment_terms ?? null,
    valid_until: raw.valid_until ?? null,
    created_by: raw.created_by ?? "staff",
    status: raw.status ?? "open",
  };
}

export function normalizeQuotations(rows: Quotation[]): Quotation[] {
  return rows.map(normalizeQuotation);
}

export function normalizeDeliveryNote(raw: DeliveryNote): DeliveryNote {
  return {
    ...raw,
    received_by: raw.received_by ?? null,
    notes: raw.notes ?? null,
  };
}

export function normalizeDeliveryNotes(rows: DeliveryNote[]): DeliveryNote[] {
  return rows.map(normalizeDeliveryNote);
}
