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

      {/* Quick view — expand + fade from the card */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          className="absolute inset-0 bg-black/75"
          aria-label="Close"
          tabIndex={open ? 0 : -1}
          onClick={() => setOpen(false)}
        />
        <div
          className={`relative w-full max-w-md bg-surface border border-line rounded-lg overflow-hidden transition-all duration-300 ease-out ${
            open ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-ink/70 text-paper font-mono text-xs flex items-center justify-center hover:bg-ink transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
          <div className="relative aspect-square bg-surface-raised">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 100vw, 448px"
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-mono text-xs text-muted">
                no image
              </div>
            )}
          </div>
          <div className="p-5">
            <h3 className="font-display text-lg text-paper mb-1">{product.name}</h3>
            {product.caption && (
              <p className="font-body text-muted text-sm mb-3">{product.caption}</p>
            )}
            <p className="font-mono text-copper-bright text-base mb-3">
              MVR {product.price.toFixed(2)}
            </p>
            <AddToCartButton product={product} />
          </div>
        </div>
      </div>
    </>
  );
}
