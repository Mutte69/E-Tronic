"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function parsePrice(value: FormDataEntryValue | null): number {
  const n = parseFloat(String(value ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/admin/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/admin");
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

async function uploadImageIfPresent(
  supabase: ReturnType<typeof createClient>,
  formData: FormData
): Promise<string | null> {
  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) return null;

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(error.message);

  const {
    data: { publicUrl },
  } = supabase.storage.from("product-images").getPublicUrl(path);

  return publicUrl;
}

export async function createProduct(formData: FormData) {
  const supabase = createClient();
  const imageUrl = await uploadImageIfPresent(supabase, formData);

  const { error } = await supabase.from("products").insert({
    name: String(formData.get("name") ?? "").trim(),
    code: String(formData.get("code") ?? "").trim() || null,
    caption: String(formData.get("caption") ?? "").trim() || null,
    price: parsePrice(formData.get("price")),
    cost_price: formData.get("cost_price")
      ? parsePrice(formData.get("cost_price"))
      : null,
    image_url: imageUrl,
    featured: formData.get("featured") === "on",
    in_stock: formData.get("in_stock") === "on",
  });

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function updateProduct(id: string, formData: FormData) {
  const supabase = createClient();
  const imageUrl = await uploadImageIfPresent(supabase, formData);

  const update: Record<string, unknown> = {
    name: String(formData.get("name") ?? "").trim(),
    code: String(formData.get("code") ?? "").trim() || null,
    caption: String(formData.get("caption") ?? "").trim() || null,
    price: parsePrice(formData.get("price")),
    cost_price: formData.get("cost_price")
      ? parsePrice(formData.get("cost_price"))
      : null,
    featured: formData.get("featured") === "on",
    in_stock: formData.get("in_stock") === "on",
    updated_at: new Date().toISOString(),
  };
  if (imageUrl) update.image_url = imageUrl;

  const { error } = await supabase.from("products").update(update).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function deleteProduct(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function toggleFeatured(id: string, next: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ featured: next })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function toggleInStock(id: string, next: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from("products")
    .update({ in_stock: next })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
}

export async function markOrderInvoiced(orderId: string) {
  const supabase = createClient();
  await supabase.from("orders").update({ status: "invoiced" }).eq("id", orderId);
  revalidatePath("/admin/orders");
}

export async function createInvoiceFromOrder(orderId: string) {
  const supabase = createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError || !order) throw new Error(orderError?.message ?? "Order not found");

  const productIds = (order.items as { product_id: string }[]).map(
    (i) => i.product_id
  );
  const { data: products } = await supabase
    .from("products")
    .select("id, cost_price")
    .in("id", productIds);

  const costByProduct = new Map(
    (products ?? []).map((p) => [p.id, p.cost_price as number | null])
  );

  const items = (
    order.items as { product_id: string; name: string; price: number; qty: number }[]
  ).map((i) => ({
    name: i.name,
    price: i.price,
    qty: i.qty,
    cost_price: costByProduct.get(i.product_id) ?? null,
  }));

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      order_id: order.id,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_address: order.customer_address,
      items,
      subtotal: order.subtotal,
    })
    .select()
    .single();

  if (error || !invoice) throw new Error(error?.message ?? "Could not create invoice");

  await supabase.from("orders").update({ status: "invoiced" }).eq("id", orderId);

  revalidatePath("/admin/orders");
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices/${invoice.id}`);
}

export async function createInvoice(formData: FormData) {
  const supabase = createClient();

  const itemsRaw = String(formData.get("items") ?? "[]");
  let items: { name: string; price: number; cost_price: number | null; qty: number }[] = [];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    items = [];
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      customer_name: String(formData.get("customer_name") ?? "").trim(),
      customer_phone: String(formData.get("customer_phone") ?? "").trim() || null,
      customer_address: String(formData.get("customer_address") ?? "").trim() || null,
      items,
      subtotal,
    })
    .select()
    .single();

  if (error || !invoice) throw new Error(error?.message ?? "Could not create invoice");

  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices/${invoice.id}`);
}

export async function toggleInvoicePaid(id: string, next: boolean) {
  const supabase = createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status: next ? "paid" : "unpaid", paid_at: next ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${id}`);
  revalidatePath("/admin/analytics");
}

export async function updateSettings(formData: FormData) {
  const supabase = createClient();

  const { error } = await supabase
    .from("settings")
    .update({
      business_name: String(formData.get("business_name") ?? "").trim() || "E Tronic",
      registration_number: String(formData.get("registration_number") ?? "").trim() || null,
      invoice_prepared_by: String(formData.get("invoice_prepared_by") ?? "").trim() || "E Tronic Sales Team",
      phone: String(formData.get("phone") ?? "").trim() || null,
      whatsapp: String(formData.get("whatsapp") ?? "").trim() || null,
      address: String(formData.get("address") ?? "").trim() || null,
      bml_account_name: String(formData.get("bml_account_name") ?? "").trim() || null,
      bml_account_number: String(formData.get("bml_account_number") ?? "").trim() || null,
      mib_account_name: String(formData.get("mib_account_name") ?? "").trim() || null,
      mib_account_number: String(formData.get("mib_account_number") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin/settings");
  redirect("/admin/settings?saved=1");
}
