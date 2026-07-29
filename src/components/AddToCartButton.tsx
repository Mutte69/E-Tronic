"use client";

import { useCart } from "@/lib/cart-context";
import type { Product } from "@/lib/types";
import { isInStock } from "@/lib/stock";

export default function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart();

  if (!isInStock(product)) {
    return (
      <span className="font-mono text-[11px] text-muted uppercase tracking-wide">
        Unavailable
      </span>
    );
  }

  return (
    <button
      onClick={() =>
        addItem({
          product_id: product.id,
          name: product.name,
          price: product.price,
        })
      }
      className="w-full mt-1 rounded-md border border-copper/50 text-copper-bright hover:bg-copper hover:text-ink transition-colors font-mono text-[11px] uppercase tracking-wide py-1.5"
    >
      Add to cart
    </button>
  );
}
