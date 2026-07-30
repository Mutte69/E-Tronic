"use client";

import { useState } from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import AddToCartButton from "@/components/AddToCartButton";
import { isInStock, lowStockLabel } from "@/lib/stock";

export default function ProductCard({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const inStock = isInStock(product);
  const lowStock = lowStockLabel(product);

  return (
    <>
      <div
        className={`group relative rounded-lg border bg-surface overflow-hidden transition-colors cursor-pointer ${
          product.featured
            ? "border-copper/50 bracket-frame"
            : "border-line hover:border-muted"
        }`}
        onClick={() => setOpen(true)}
      >
        {product.featured && (
          <span className="absolute top-3 left-3 z-10 font-mono text-[10px] tracking-widest uppercase bg-copper text-ink px-2 py-1 rounded-sm">
            Featured
          </span>
        )}
        <div className="relative aspect-square bg-surface-raised overflow-hidden">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-mono text-xs text-muted">
              no image
            </div>
          )}
          {!inStock && (
            <div className="absolute inset-0 bg-ink/70 flex items-center justify-center">
              <span className="font-mono text-xs tracking-widest uppercase text-muted">
                Out of stock
              </span>
            </div>
          )}
          {inStock && lowStock && (
            <span className="absolute bottom-2 right-2 z-10 font-mono text-[10px] tracking-wide uppercase bg-ink/80 text-copper-bright px-2 py-1 rounded-sm">
              {lowStock}
            </span>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-body text-paper text-sm font-medium mb-1 truncate">
            {product.name}
          </h3>
          {product.caption && (
            <p className="font-body text-muted text-xs mb-2 line-clamp-2">
              {product.caption}
            </p>
          )}
          <p className="font-mono text-copper-bright text-sm mb-2">
            MVR {product.price.toFixed(2)}
          </p>
          <div onClick={(e) => e.stopPropagation()}>
            <AddToCartButton product={product} />
          </div>
        </div>
      </div>

      {/* Full detail view — expand + fade from the card */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center sm:p-6 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          className="absolute inset-0 bg-black/80"
          aria-label="Close"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
        />
        <div
          className={`relative w-full h-full sm:h-auto sm:max-h-[85vh] sm:max-w-3xl bg-surface sm:border sm:border-line sm:rounded-lg overflow-y-auto transition-all duration-300 ease-out ${
            open ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-ink/70 text-paper font-mono text-sm flex items-center justify-center hover:bg-ink transition-colors"
            aria-label="Close"
          >
            ✕
          </button>

          <div className="flex flex-col sm:flex-row">
            <div className="relative w-full h-72 sm:h-auto sm:w-1/2 bg-surface-raised shrink-0">
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-contain"
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

            <div className="p-6 sm:p-8 sm:w-1/2 flex flex-col">
              <h3 className="font-display text-2xl text-paper mb-2">{product.name}</h3>
              {product.caption && (
                <p className="font-body text-muted text-sm leading-relaxed mb-4">
                  {product.caption}
                </p>
              )}
              <p className="font-mono text-copper-bright text-2xl mb-2">
                MVR {product.price.toFixed(2)}
              </p>
              {!inStock ? (
                <p className="font-mono text-xs uppercase tracking-wide text-muted mb-4">
                  Out of stock
                </p>
              ) : (
                lowStock && (
                  <p className="font-mono text-xs uppercase tracking-wide text-copper-bright mb-4">
                    {lowStock}
                  </p>
                )
              )}
              <div className="mt-auto pt-4">
                <AddToCartButton product={product} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
