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
      className="relative w-full h-full min-h-[260px] md:min-h-0 bg-ink"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <button
        onClick={() => setDetailOpen(true)}
        className="block w-full h-full text-left cursor-pointer"
        aria-label={`View ${current.name}`}
      >
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
                sizes="(max-width: 768px) 100vw, 45vw"
                className="object-contain"
                priority={i === 0}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-surface-raised font-mono text-xs text-muted">
                no image
              </div>
            )}
          </div>
        ))}
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink/60 to-transparent" />

      <span className="pointer-events-none absolute top-4 right-4 font-mono text-[10px] tracking-[0.3em] uppercase bg-ink/60 backdrop-blur-sm text-copper-bright px-2.5 py-1 rounded-sm border border-copper/30">
        Featured
      </span>

      {products.length > 1 && (
        <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
          {products.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIndex(i)}
              aria-label={`Show ${p.name}`}
              className={`h-1 rounded-full transition-all ${
                i === index ? "w-5 bg-copper-bright" : "w-1 bg-paper/40"
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
