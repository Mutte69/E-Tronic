"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildOrderMessage, buildWhatsAppLink } from "@/lib/whatsapp";
import type { CartLineItem, Quotation } from "@/lib/types";

export async function createOrder(formData: FormData) {
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const customerPhone = String(formData.get("customer_phone") ?? "").trim();
  const customerAddress = String(formData.get("customer_address") ?? "").trim();
  const itemsRaw = String(formData.get("items") ?? "[]");

  // honeypot — a hidden field real customers never see or fill
  const honeypot = String(formData.get("website") ?? "").trim();
  if (honeypot) {
    redirect("/?order_saved=1#products");
  }

  // reject submissions that happen implausibly fast (bots)
  const renderedAt = Number(formData.get("form_rendered_at") ?? 0);
  if (renderedAt && Date.now() - renderedAt < 2000) {
    redirect("/?order_saved=1#products");
  }

  let items: CartLineItem[] = [];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    items = [];
  }

  if (!customerName || !customerPhone || !customerAddress || items.length === 0) {
    redirect("/?order_error=1#products");
  }

  const supabase = createClient();

  // guard against accidental double-submits / rapid repeat spam from the
  // same number
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recentDuplicate } = await supabase
    .from("orders")
    .select("id")
    .eq("customer_phone", customerPhone)
    .gte("created_at", twoMinutesAgo)
    .limit(1)
    .maybeSingle();

  if (recentDuplicate) {
    redirect("/?order_saved=1#products");
  }

  // Re-check current prices/names from the database — never trust
  // prices submitted from the browser for what gets saved as an order.
  const productIds = items.map((i) => i.product_id).filter(Boolean);
  const { data: currentProducts } = await supabase
    .from("products")
    .select("id, name, price")
    .in("id", productIds);

  const byId = new Map((currentProducts ?? []).map((p) => [p.id, p]));
  const verifiedItems: CartLineItem[] = items.map((item) => {
    const current = byId.get(item.product_id);
    return current
      ? { product_id: item.product_id, name: current.name, price: current.price, qty: item.qty }
      : item; // product may have been removed since — keep what the customer saw
  });

  const subtotal = verifiedItems.reduce((sum, i) => sum + i.price * i.qty, 0);

  const [{ error }, { data: settings }] = await Promise.all([
    supabase.from("orders").insert({
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_address: customerAddress,
      items: verifiedItems,
      subtotal,
    }),
    supabase.from("settings").select("whatsapp").eq("id", 1).single(),
  ]);

  if (error) {
    redirect("/?order_error=1#products");
  }

  const message = buildOrderMessage({
    items: verifiedItems,
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

export async function createPublicQuotation({
  items,
  customerName,
  customerPhone,
  customerAddress,
  formRenderedAt,
  honeypot,
}: {
  items: CartLineItem[];
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  formRenderedAt: number;
  honeypot: string;
}): Promise<{ ok: true; quotation: Quotation } | { ok: false; error: string }> {
  if (honeypot?.trim()) {
    return { ok: false, error: "Could not create quotation." };
  }
  if (formRenderedAt && Date.now() - formRenderedAt < 2000) {
    return { ok: false, error: "Could not create quotation." };
  }

  const name = customerName.trim();
  const phone = customerPhone.trim();
  const address = customerAddress.trim();

  if (!name || !phone || !address || items.length === 0) {
    return { ok: false, error: "Please fill in your name, phone, and address." };
  }

  const supabase = createClient();

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recentDuplicate } = await supabase
    .from("quotations")
    .select("id")
    .eq("customer_phone", phone)
    .eq("created_by", "customer")
    .gte("created_at", twoMinutesAgo)
    .limit(1)
    .maybeSingle();

  if (recentDuplicate) {
    return { ok: false, error: "You already generated a quotation just now — check your downloads." };
  }

  // Re-check current prices/names from the database — never trust prices
  // submitted from the browser for what gets saved as a quotation.
  const productIds = items.map((i) => i.product_id).filter(Boolean);
  const { data: currentProducts } = await supabase
    .from("products")
    .select("id, name, price")
    .in("id", productIds);

  const byId = new Map((currentProducts ?? []).map((p) => [p.id, p]));
  const verifiedItems = items.map((item) => {
    const current = byId.get(item.product_id);
    return {
      product_id: item.product_id,
      name: current?.name ?? item.name,
      price: current?.price ?? item.price,
      cost_price: null,
      qty: item.qty,
    };
  });

  const subtotal = verifiedItems.reduce((sum, i) => sum + i.price * i.qty, 0);

  const { data, error } = await supabase.rpc("create_customer_quotation", {
    p_customer_name: name,
    p_customer_phone: phone,
    p_customer_address: address,
    p_items: verifiedItems,
    p_subtotal: subtotal,
  });

  if (error || !data || data.length === 0) {
    return { ok: false, error: "Something went wrong creating your quotation. Please try again." };
  }

  return { ok: true, quotation: data[0] as Quotation };
}
