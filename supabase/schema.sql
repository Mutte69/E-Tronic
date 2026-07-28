-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- This is the full schema, including orders/invoices/cost tracking.
-- If you already ran an earlier version of this file, this one is safe
-- to run again — it only creates what's missing.

-- 1. PRODUCTS TABLE
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  caption text,
  price numeric(10,2) not null default 0,
  cost_price numeric(10,2),
  image_url text,
  featured boolean not null default false,
  sort_order int not null default 0,
  in_stock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table products add column if not exists cost_price numeric(10,2);

alter table products enable row level security;

drop policy if exists "Public can view products" on products;
create policy "Public can view products"
  on products for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated can manage products" on products;
create policy "Authenticated can manage products"
  on products for all
  to authenticated
  using (true)
  with check (true);

-- 2. SETTINGS TABLE (single row: contact + payment info)
create table if not exists settings (
  id int primary key default 1,
  business_name text not null default 'E Tronic',
  phone text,
  whatsapp text,
  address text,
  bml_account_name text,
  bml_account_number text,
  mib_account_name text,
  mib_account_number text,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into settings (id, business_name) values (1, 'E Tronic')
  on conflict (id) do nothing;

alter table settings enable row level security;

drop policy if exists "Public can view settings" on settings;
create policy "Public can view settings"
  on settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated can update settings" on settings;
create policy "Authenticated can update settings"
  on settings for update
  to authenticated
  using (true)
  with check (true);

-- 3. STORAGE BUCKET for product photos
insert into storage.buckets (id, name, public)
  values ('product-images', 'product-images', true)
  on conflict (id) do nothing;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Authenticated can upload product images" on storage.objects;
create policy "Authenticated can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Authenticated can update product images" on storage.objects;
create policy "Authenticated can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Authenticated can delete product images" on storage.objects;
create policy "Authenticated can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');

-- 4. ORDERS TABLE (created when a customer checks out via the cart)
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  customer_address text not null,
  items jsonb not null default '[]',
  subtotal numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'invoiced')),
  created_at timestamptz not null default now()
);

alter table orders enable row level security;

drop policy if exists "Public can create orders" on orders;
create policy "Public can create orders"
  on orders for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Authenticated can manage orders" on orders;
create policy "Authenticated can manage orders"
  on orders for all
  to authenticated
  using (true)
  with check (true);

-- 5. INVOICES TABLE
create sequence if not exists invoice_no_seq start 1001;

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no int not null default nextval('invoice_no_seq') unique,
  order_id uuid references orders(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  customer_address text,
  items jsonb not null default '[]',
  subtotal numeric(10,2) not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table invoices enable row level security;

drop policy if exists "Authenticated can manage invoices" on invoices;
create policy "Authenticated can manage invoices"
  on invoices for all
  to authenticated
  using (true)
  with check (true);
