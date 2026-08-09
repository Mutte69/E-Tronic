"use client";

import { useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import type { Product, Category } from "@/lib/types";

export default function ProductBrowser({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const [activeId, setActiveId] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    if (activeId === "all") return products;
    return products.filter((p) => p.category_id === activeId);
  }, [products, activeId]);

  const usedCategoryIds = new Set(products.map((p) => p.category_id).filter(Boolean));
  const visibleCategories = categories.filter((c) => usedCategoryIds.has(c.id));

  return (
    <div>
      {visibleCategories.length > 0 && (
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveId("all")}
            className={`shrink-0 font-mono text-[11px] uppercase tracking-wide px-3 py-1.5 rounded-full border transition-colors ${
              activeId === "all"
                ? "bg-copper text-ink border-copper"
                : "border-line text-muted hover:text-paper"
            }`}
          >
            All
          </button>
          {visibleCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`shrink-0 font-mono text-[11px] uppercase tracking-wide px-3 py-1.5 rounded-full border transition-colors ${
                activeId === c.id
                  ? "bg-copper text-ink border-copper"
                  : "border-line text-muted hover:text-paper"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="font-body text-muted text-sm">
          No products in this category yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p, i) => (
            <div
              key={p.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i * 60, 400)}ms` }}
            >
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
