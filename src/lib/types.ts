export type Product = {
  id: string;
  name: string;
  code: string | null;
  caption: string | null;
  price: number;
  cost_price: number | null;
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
  customer_name: string;
  customer_phone: string | null;
  customer_address: string | null;
  items: InvoiceLineItem[];
  subtotal: number;
  status: "unpaid" | "paid";
  created_at: string;
  paid_at: string | null;
};
