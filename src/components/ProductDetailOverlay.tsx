"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { Product } from "@/lib/types";
import AddToCartButton from "@/components/AddToCartButton";
import { isInStock, lowStockLabel } from "@/lib/stock";

export default function ProductDetailOverlay({
  product,
  open,
  onClose,
}: {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !product) return null;

  const inStock = isInStock(product);
  const lowStock = lowStockLabel(product);

  const view = (
    <div
      className={`fixed inset-0 z-[100] bg-surface overflow-y-auto transition-opacity duration-300 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-10 w-9 h-9 rounded-full bg-ink/80 text-paper font-mono text-sm flex items-center justify-center hover:bg-ink transition-colors"
        aria-label="Close"
      >
        ✕
      </button>

      <div
        className={`min-h-full flex flex-col md:flex-row transition-all duration-300 ease-out ${
          open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        }`}
      >
        <div className="relative w-full h-[45vh] md:h-screen md:w-1/2 bg-surface-raised shrink-0">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain"
              priority={open}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-mono text-xs text-muted">
              no image
            </div>
          )}
          {product.featured && (
            <span className="absolute top-4 left-4 font-mono text-[10px] tracking-widest uppercase bg-copper text-ink px-2 py-1 rounded-sm">
              Featured
            </span>
          )}
        </div>

        <div className="p-6 sm:p-10 md:w-1/2 flex flex-col md:justify-center md:min-h-screen">
          <h3 className="font-display text-2xl sm:text-3xl text-paper mb-3">
            {product.name}
          </h3>
          {product.caption && (
            <p className="font-body text-muted text-sm sm:text-base leading-relaxed mb-5 max-w-md">
              {product.caption}
            </p>
          )}
          <p className="font-mono text-copper-bright text-2xl sm:text-3xl mb-3">
            MVR {product.price.toFixed(2)}
          </p>
          {!inStock ? (
            <p className="font-mono text-xs uppercase tracking-wide text-muted mb-5">
              Out of stock
            </p>
          ) : (
            lowStock && (
              <p className="font-mono text-xs uppercase tracking-wide text-copper-bright mb-5">
                {lowStock}
              </p>
            )
          )}
          <div className="max-w-xs">
            <AddToCartButton product={product} />
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(view, document.body);
}
