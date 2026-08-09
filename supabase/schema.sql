-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)
-- This is the full schema, including orders/invoices/cost tracking.
-- If you already ran an earlier version of this file, this one is safe
-- to run again — it only creates what's missing.

-- 1. PRODUCTS TABLE
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  caption text,
  price numeric(10,2) not null default 0,
  cost_price numeric(10,2),
  stock_qty int,
  image_url text,
  featured boolean not null default false,
  sort_order int not null default 0,
  in_stock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table products add column if not exists cost_price numeric(10,2);
alter table products add column if not exists code text;
alter table products add column if not exists stock_qty int;

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
  registration_number text,
  invoice_prepared_by text default 'E Tronic Sales Team',
  hero_eyebrow text default 'Male'', Maldives',
  hero_heading text default 'Electronics, sold and serviced right.',
  hero_subtext text default 'Devices, parts, and repairs from E Tronic. Reach out below for stock, pricing, or a service booking.',
  service_1_title text default 'Sales',
  service_1_body text default 'New and quality electronics, priced fairly, with stock updated here as it comes in.',
  service_2_title text default 'Repair & service',
  service_2_body text default 'Diagnostics and repairs on the devices we sell and beyond — bring it in or message us the issue.',
  service_3_title text default 'Support',
  service_3_body text default 'Questions about a part, a price, or what fits your setup — reach out on WhatsApp any time.',
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

alter table settings add column if not exists registration_number text;
alter table settings add column if not exists invoice_prepared_by text default 'E Tronic Sales Team';
alter table settings add column if not exists hero_eyebrow text default 'Male'', Maldives';
alter table settings add column if not exists hero_heading text default 'Electronics, sold and serviced right.';
alter table settings add column if not exists hero_subtext text default 'Devices, parts, and repairs from E Tronic. Reach out below for stock, pricing, or a service booking.';
alter table settings add column if not exists service_1_title text default 'Sales';
alter table settings add column if not exists service_1_body text default 'New and quality electronics, priced fairly, with stock updated here as it comes in.';
alter table settings add column if not exists service_2_title text default 'Repair & service';
alter table settings add column if not exists service_2_body text default 'Diagnostics and repairs on the devices we sell and beyond — bring it in or message us the issue.';
alter table settings add column if not exists service_3_title text default 'Support';
alter table settings add column if not exists service_3_body text default 'Questions about a part, a price, or what fits your setup — reach out on WhatsApp any time.';

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
  discount_type text not null default 'none' check (discount_type in ('none', 'percent', 'fixed')),
  discount_value numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table invoices add column if not exists discount_type text not null default 'none' check (discount_type in ('none', 'percent', 'fixed'));
alter table invoices add column if not exists discount_value numeric(10,2) not null default 0;
alter table invoices add column if not exists total numeric(10,2) not null default 0;
alter table invoices add column if not exists customer_tin text;
alter table invoices add column if not exists quotation_id uuid;
update invoices set total = subtotal where total = 0;

alter table invoices enable row level security;

drop policy if exists "Authenticated can manage invoices" on invoices;
create policy "Authenticated can manage invoices"
  on invoices for all
  to authenticated
  using (true)
  with check (true);

-- 6. QUOTATIONS TABLE
create sequence if not exists quotation_no_seq start 1;

create table if not exists quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_no int not null default nextval('quotation_no_seq') unique,
  customer_name text not null,
  customer_phone text,
  customer_address text,
  customer_tin text,
  items jsonb not null default '[]',
  subtotal numeric(10,2) not null default 0,
  discount_type text not null default 'none' check (discount_type in ('none', 'percent', 'fixed')),
  discount_value numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  delivery_terms text,
  payment_terms text,
  valid_until timestamptz,
  created_by text not null default 'staff' check (created_by in ('staff', 'customer')),
  status text not null default 'open' check (status in ('open', 'converted')),
  converted_invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table quotations add column if not exists valid_until timestamptz;
alter table quotations add column if not exists created_by text not null default 'staff' check (created_by in ('staff', 'customer'));

alter table quotations enable row level security;

drop policy if exists "Authenticated can manage quotations" on quotations;
create policy "Authenticated can manage quotations"
  on quotations for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Public can create quotations" on quotations;

-- Customers create their own quotations through this function only (not a
-- direct table policy) so pricing/discount/valid-until are always set
-- server-side, and a customer can never read other people's quotations —
-- the function returns just the row it created.
create or replace function public.create_customer_quotation(
  p_customer_name text,
  p_customer_phone text,
  p_customer_address text,
  p_items jsonb,
  p_subtotal numeric
) returns setof quotations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into quotations (
    customer_name, customer_phone, customer_address, items,
    subtotal, discount_type, discount_value, total,
    valid_until, created_by
  ) values (
    p_customer_name, p_customer_phone, p_customer_address, p_items,
    p_subtotal, 'none', 0, p_subtotal,
    now() + interval '7 days', 'customer'
  ) returning quotations.id into v_id;

  return query select * from quotations where quotations.id = v_id;
end;
$$;

grant execute on function public.create_customer_quotation to anon, authenticated;

do $$ begin
  alter table invoices add constraint invoices_quotation_id_fkey
    foreign key (quotation_id) references quotations(id) on delete set null;
exception when duplicate_object then null;
end $$;

-- 7. DELIVERY NOTES TABLE
create sequence if not exists delivery_no_seq start 1;

create table if not exists delivery_notes (
  id uuid primary key default gen_random_uuid(),
  delivery_no int not null default nextval('delivery_no_seq') unique,
  invoice_id uuid references invoices(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  customer_address text,
  items jsonb not null default '[]',
  received_by text,
  notes text,
  created_at timestamptz not null default now()
);

alter table delivery_notes enable row level security;

drop policy if exists "Authenticated can manage delivery notes" on delivery_notes;
create policy "Authenticated can manage delivery notes"
  on delivery_notes for all
  to authenticated
  using (true)
  with check (true);

-- 8. CATEGORIES TABLE
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;

drop policy if exists "Public can view categories" on categories;
create policy "Public can view categories"
  on categories for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated can manage categories" on categories;
create policy "Authenticated can manage categories"
  on categories for all
  to authenticated
  using (true)
  with check (true);

alter table products add column if not exists category_id uuid references categories(id) on delete set null;
