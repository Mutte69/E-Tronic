import type { Product } from "@/lib/types";

const LOW_STOCK_THRESHOLD = 3;

export function isInStock(product: Product): boolean {
  if (product.stock_qty != null) return product.stock_qty > 0;
  return product.in_stock;
}

export function lowStockLabel(product: Product): string | null {
  if (product.stock_qty == null) return null;
  if (product.stock_qty <= 0) return null;
  if (product.stock_qty > LOW_STOCK_THRESHOLD) return null;
  return `Only ${product.stock_qty} left`;
}
