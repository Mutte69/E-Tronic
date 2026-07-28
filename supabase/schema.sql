-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)

-- 1. PRODUCTS TABLE
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  caption text,
  price numeric(10,2) not null default 0,
  image_url text,
  featured boolean not null default false,
  sort_order int not null default 0,
  in_stock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table products enable row level security;

create policy "Public can view products"
  on products for select
  to anon, authenticated
  using (true);

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

create policy "Public can view settings"
  on settings for select
  to anon, authenticated
  using (true);

create policy "Authenticated can update settings"
  on settings for update
  to authenticated
  using (true)
  with check (true);

-- 3. STORAGE BUCKET for product photos
insert into storage.buckets (id, name, public)
  values ('product-images', 'product-images', true)
  on conflict (id) do nothing;

create policy "Public can view product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy "Authenticated can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images');

create policy "Authenticated can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images');

create policy "Authenticated can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images');
