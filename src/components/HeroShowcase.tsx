"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import ProductDetailOverlay from "@/components/ProductDetailOverlay";

const ROTATE_MS = 4000;

export default function HeroShowcase({ products }: { products: Product[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (paused || detailOpen || products.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % products.length);
    }, ROTATE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, detailOpen, products.length]);

  if (products.length === 0) return null;
  const current = products[index];

  return (
    <div
      className="bracket-frame border border-line rounded-lg bg-surface overflow-hidden animate-fade-in-up"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-copper-bright px-5 pt-5">
        Featured
      </p>

      <button
        onClick={() => setDetailOpen(true)}
        className="block w-full text-left cursor-pointer"
        aria-label={`View ${current.name}`}
      >
        <div className="relative w-full aspect-square sm:aspect-[4/3] mt-3 bg-surface-raised">
          {products.map((p, i) => (
            <div
              key={p.id}
              className={`absolute inset-0 transition-opacity duration-700 ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
            >
              {p.image_url ? (
                <Image
                  src={p.image_url}
                  alt={p.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 40vw"
                  className="object-contain"
                  priority={i === 0}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-mono text-xs text-muted">
                  no image
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-5">
          <p className="font-body text-paper text-base font-medium truncate">
            {current.name}
          </p>
          <p className="font-mono text-copper-bright text-lg mt-1">
            MVR {current.price.toFixed(2)}
          </p>
        </div>
      </button>

      {products.length > 1 && (
        <div className="flex items-center gap-1.5 px-5 pb-5">
          {products.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIndex(i)}
              aria-label={`Show ${p.name}`}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-copper" : "w-1.5 bg-line"
              }`}
            />
          ))}
        </div>
      )}

      <ProductDetailOverlay
        product={current}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
}
