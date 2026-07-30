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

      {/* Full detail view — full-screen takeover, not a floating modal */}
      <div
        className={`fixed inset-0 z-50 bg-surface overflow-y-auto transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={() => setOpen(false)}
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
    </>
  );
}
