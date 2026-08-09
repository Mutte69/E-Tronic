"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { createOrder, createPublicQuotation } from "@/app/actions";
import { downloadQuotationPdf } from "@/lib/quotation-pdf";
import SubmitButton from "@/components/SubmitButton";
import type { Settings } from "@/lib/types";

export default function CartDrawer({ settings }: { settings: Settings | null }) {
  const { items, removeItem, setQty, subtotal, count, clear } = useCart();
  const [open, setOpen] = useState(false);
  const [renderedAt, setRenderedAt] = useState(0);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteDone, setQuoteDone] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (open && !renderedAt) setRenderedAt(Date.now());
  }, [open, renderedAt]);

  async function handleGetQuotation() {
    if (!formRef.current) return;
    const fd = new FormData(formRef.current);
    setQuoteError(null);
    setQuoting(true);
    try {
      const result = await createPublicQuotation({
        items,
        customerName: String(fd.get("customer_name") ?? ""),
        customerPhone: String(fd.get("customer_phone") ?? ""),
        customerAddress: String(fd.get("customer_address") ?? ""),
        formRenderedAt: renderedAt,
        honeypot: String(fd.get("website") ?? ""),
      });

      if (!result.ok) {
        setQuoteError(result.error);
        return;
      }

      await downloadQuotationPdf(result.quotation, settings);
      const validUntil = result.quotation.valid_until
        ? new Date(result.quotation.valid_until).toLocaleDateString()
        : null;
      setQuoteDone(validUntil);
      clear();
    } catch (err) {
      setQuoteError(
        err instanceof Error
          ? `Something went wrong: ${err.message}`
          : "Something went wrong creating your quotation. Please try again."
      );
    } finally {
      setQuoting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-copper hover:bg-copper-bright active:scale-95 transition-all duration-150 text-ink font-mono text-xs font-medium px-4 py-3 shadow-lg"
        aria-label="Open cart"
      >
        Cart
        {count > 0 && (
          <span className="bg-ink text-copper-bright rounded-full w-5 h-5 flex items-center justify-center text-[10px]">
            {count}
          </span>
        )}
      </button>

      <div
        className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          className="absolute inset-0 bg-black/70"
          aria-label="Close cart"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
        />
        <div
          className={`relative w-full max-w-sm bg-surface border-l border-line h-full overflow-y-auto p-6 transition-transform duration-300 ease-out ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-lg">Your cart</h2>
              <button
                onClick={() => setOpen(false)}
                className="font-mono text-xs text-muted hover:text-paper"
              >
                Close
              </button>
            </div>

            {quoteDone ? (
              <div className="border border-copper/40 rounded-md p-4 mb-4">
                <p className="font-body text-sm text-paper mb-1">
                  Quotation downloaded.
                </p>
                <p className="font-body text-xs text-muted">
                  Valid until {quoteDone}. Check your downloads for the PDF.
                </p>
                <button
                  onClick={() => setQuoteDone(null)}
                  className="mt-3 font-mono text-xs text-copper-bright hover:text-copper transition-colors"
                >
                  Start a new cart
                </button>
              </div>
            ) : items.length === 0 ? (
              <p className="font-body text-sm text-muted">Your cart is empty.</p>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  {items.map((item) => (
                    <div
                      key={item.product_id}
                      className="border border-line rounded-md p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-body text-sm text-paper">{item.name}</p>
                        <button
                          onClick={() => removeItem(item.product_id)}
                          className="font-mono text-[10px] text-muted hover:text-copper-bright"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setQty(item.product_id, item.qty - 1)}
                            className="w-6 h-6 rounded-sm border border-line text-paper font-mono text-xs"
                          >
                            −
                          </button>
                          <span className="font-mono text-sm w-6 text-center">
                            {item.qty}
                          </span>
                          <button
                            onClick={() => setQty(item.product_id, item.qty + 1)}
                            className="w-6 h-6 rounded-sm border border-line text-paper font-mono text-xs"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-mono text-sm text-copper-bright">
                          MVR {(item.price * item.qty).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mb-6 font-body text-sm">
                  <span className="text-muted">Total</span>
                  <span className="font-mono text-copper-bright text-base">
                    MVR {subtotal.toFixed(2)}
                  </span>
                </div>

                {(
                  <form ref={formRef} action={createOrder} onSubmit={() => clear()} className="space-y-3">
                    <input type="hidden" name="items" value={JSON.stringify(items)} />
                    <input type="hidden" name="form_rendered_at" value={renderedAt} />
                    {/* honeypot — real customers never see or fill this */}
                    <div className="absolute -left-[9999px]" aria-hidden="true">
                      <label htmlFor="website">Leave this field empty</label>
                      <input
                        id="website"
                        name="website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-xs text-muted mb-1">
                        Your name
                      </label>
                      <input
                        name="customer_name"
                        required
                        className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-xs text-muted mb-1">
                        Contact number
                      </label>
                      <input
                        name="customer_phone"
                        required
                        className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-body text-xs text-muted mb-1">
                        Delivery address
                      </label>
                      <textarea
                        name="customer_address"
                        required
                        rows={2}
                        className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
                      />
                    </div>

                    <SubmitButton
                      pendingText="Sending…"
                      className="w-full justify-center rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium py-2.5"
                    >
                      Send order to WhatsApp
                    </SubmitButton>

                    <div className="flex items-center gap-2">
                      <span className="flex-1 h-px bg-line" />
                      <span className="font-mono text-[10px] text-muted uppercase">or</span>
                      <span className="flex-1 h-px bg-line" />
                    </div>

                    <button
                      type="button"
                      onClick={handleGetQuotation}
                      disabled={quoting}
                      className="w-full rounded-md border border-copper/60 text-copper-bright hover:bg-copper hover:text-ink transition-colors font-body text-sm font-medium py-2.5 disabled:opacity-50"
                    >
                      {quoting ? "Preparing…" : "Get a quotation (PDF)"}
                    </button>

                    {quoteError && (
                      <p className="font-body text-xs text-copper-bright">{quoteError}</p>
                    )}

                    <p className="font-body text-xs text-muted">
                      WhatsApp sends your order straight to us. A quotation
                      downloads a priced PDF you can keep — valid for 7 days.
                    </p>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
    </>
  );
}
