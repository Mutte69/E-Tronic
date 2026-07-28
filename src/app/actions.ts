"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildOrderMessage, buildWhatsAppLink } from "@/lib/whatsapp";
import type { CartLineItem } from "@/lib/types";

export async function createOrder(formData: FormData) {
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const customerPhone = String(formData.get("customer_phone") ?? "").trim();
  const customerAddress = String(formData.get("customer_address") ?? "").trim();
  const itemsRaw = String(formData.get("items") ?? "[]");

  let items: CartLineItem[] = [];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    items = [];
  }

  if (!customerName || !customerPhone || !customerAddress || items.length === 0) {
    redirect("/?order_error=1#products");
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  const supabase = createClient();

  const [{ error }, { data: settings }] = await Promise.all([
    supabase.from("orders").insert({
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      items,
      subtotal,
    }),
    supabase.from("settings").select("whatsapp").eq("id", 1).single(),
  ]);

  if (error) {
    redirect("/?order_error=1#products");
  }

  const message = buildOrderMessage({
    items,
    subtotal,
    customerName,
    customerPhone,
    customerAddress,
  });

  const waNumber = settings?.whatsapp ?? "";
  if (!waNumber) {
    // No WhatsApp number configured yet — order is saved, just can't hand off.
    redirect("/?order_saved=1#products");
  }

  redirect(buildWhatsAppLink(waNumber, message));
}
