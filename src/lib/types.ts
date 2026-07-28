export type Product = {
  id: string;
  name: string;
  caption: string | null;
  price: number;
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
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  bml_account_name: string | null;
  bml_account_number: string | null;
  mib_account_name: string | null;
  mib_account_number: string | null;
  updated_at: string;
};
