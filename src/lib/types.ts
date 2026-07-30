export type Product = {
  id: string;
  name: string;
  code: string | null;
  caption: string | null;
  price: number;
  cost_price: number | null;
  stock_qty: number | null;
  image_url: string | null;
  featured: boolean;
  sort_order: number;
  in_stock: boolean;
  created_at: string;
  updated_at: string;
};

export type Settings = {
  id: number;
  business_name: string;
  registration_number: string | null;
  invoice_prepared_by: string | null;
  hero_eyebrow: string | null;
  hero_heading: string | null;
  hero_subtext: string | null;
  service_1_title: string | null;
  service_1_body: string | null;
  service_2_title: string | null;
  service_2_body: string | null;
  service_3_title: string | null;
  service_3_body: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  bml_account_name: string | null;
  bml_account_number: string | null;
  mib_account_name: string | null;
  mib_account_number: string | null;
  updated_at: string;
};

export type CartLineItem = {
  product_id: string;
  name: string;
  price: number;
  qty: number;
};

export type InvoiceLineItem = {
  product_id?: string | null;
  name: string;
  price: number;
  cost_price: number | null;
  qty: number;
};

export type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items: CartLineItem[];
  subtotal: number;
  status: "pending" | "invoiced";
  created_at: string;
};

export type Invoice = {
  id: string;
  invoice_no: number;
  order_id: string | null;
  quotation_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  customer_tin: string | null;
  items: InvoiceLineItem[];
  subtotal: number;
  discount_type: "none" | "percent" | "fixed";
  discount_value: number;
  total: number;
  status: "unpaid" | "paid";
  created_at: string;
  paid_at: string | null;
};

export type Quotation = {
  id: string;
  quotation_no: number;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  customer_tin: string | null;
  items: InvoiceLineItem[];
  subtotal: number;
  discount_type: "none" | "percent" | "fixed";
  discount_value: number;
  total: number;
  delivery_terms: string | null;
  payment_terms: string | null;
  status: "open" | "converted";
  converted_invoice_id: string | null;
  created_at: string;
};

export type DeliveryNoteItem = {
  name: string;
  qty: number;
};

export type DeliveryNote = {
  id: string;
  delivery_no: number;
  invoice_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  items: DeliveryNoteItem[];
  received_by: string | null;
  notes: string | null;
  created_at: string;
};
