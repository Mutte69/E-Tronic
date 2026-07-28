import type { CartLineItem } from "@/lib/types";

export function buildOrderMessage({
  items,
  subtotal,
  customerName,
  customerPhone,
  customerAddress,
}: {
  items: CartLineItem[];
  subtotal: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
}): string {
  const lines = items.map(
    (item) =>
      `${item.qty}x ${item.name} — MVR ${(item.price * item.qty).toFixed(2)}`
  );

  return [
    "New order from the E Tronic website:",
    "",
    ...lines,
    "",
    `Total: MVR ${subtotal.toFixed(2)}`,
    "",
    `Name: ${customerName}`,
    `Phone: ${customerPhone}`,
    `Delivery address: ${customerAddress}`,
  ].join("\n");
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
