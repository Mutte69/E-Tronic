# E Tronic website

Next.js site + admin dashboard for E Tronic. Customers browse products,
build a cart, and check out straight to WhatsApp with an itemized
message. The admin dashboard (`/admin`) lets your brother run
everything himself — products, orders, invoices, and sales — no code
required.

## What's in here

- **Public site** — dark theme matching the logo, featured row, full
  catalogue, cart with WhatsApp checkout, contact + BML/MIB bank details
- **Admin dashboard**
  - **Products** — photo, name, description, price, and a private cost
    price (for profit tracking only, never shown to customers)
  - **Branded card generator** — pick a photo, fill in name + price,
    hit *Generate branded card* and it composites the E Tronic logo,
    name, and price onto the photo before it's posted
  - **Quotations** — build a quote with customer details, delivery and
    payment terms; one click converts it to an invoice
  - **Orders** — every WhatsApp cart checkout lands here first, so you
    can turn it into an invoice with one click
  - **Invoices** — itemized, printable, with a **PAID** stamp once
    marked paid; one click creates a delivery note once goods are handed over
  - **Delivery notes** — item/quantity only (no prices), with signature lines
  - **Analytics** — today/this month's sales, profit (using your cost
    prices), last 7 days chart, order counts

## 1. Create a Supabase project (free tier is enough)

1. Go to https://supabase.com, sign up, and create a new project.
   (If you already use Supabase for another business like Samuga Menu,
   still create a **separate new project** for E Tronic — don't share
   one project between businesses.)
2. Once it's ready, open **SQL Editor > New query**, paste in the
   contents of `supabase/schema.sql` from this repo, and run it. This
   creates all the tables (products, settings, orders, invoices) and
   the photo storage bucket. It's safe to run again later if this file
   gets updated — it only creates what's missing.
3. Go to **Authentication > Users > Add user** and create one user with
   your brother's email and a password — that's his admin login.
4. Go to **Settings > API** and copy:
   - `Project URL`
   - `anon public` key

## 2. Set environment variables

Copy `.env.example` to `.env.local` and fill in the two values from
step 1:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 3. Run it locally (optional, to preview before deploying)

```
npm install
npm run dev
```

Open http://localhost:3000 for the public site, and
http://localhost:3000/admin for the dashboard.

## 4. Deploy — GitHub + Railway

1. Push this folder to a new GitHub repo.
2. In Railway: **New Project > Deploy from GitHub repo**, pick the repo.
3. In the Railway project's **Variables** tab, add the same two
   variables from step 2 (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Railway will run `npm run build` then `npm run start` automatically
   (it reads these from `package.json`). Once it finishes, Railway
   gives you a live URL — attach your domain in the **Settings >
   Networking** tab if you have one.

## Using the admin dashboard

- **Products**: add a photo, name, price, and (optionally) your cost
  price. Once a photo is chosen, hit **Generate branded card** — this
  overlays the E Tronic logo, item name, and price onto the photo, and
  that's the image that gets posted. "Featured" items show in their
  own row at the top of the homepage.
- **Orders**: when a customer checks out through the site's cart, the
  order lands here with their name, phone, and address. Hit **Create
  invoice** to turn it into a proper invoice.
- **Invoices**: itemized, printable (use *Print / save as PDF*).
  **Mark as paid** stamps it PAID. You can also create a standalone
  invoice from here for phone/in-person orders.
- **Analytics**: today's and this month's sales and profit, a 7-day
  chart, and running totals. Profit uses the cost price you set per
  product (or per invoice line for manual invoices). Numbers count
  once an invoice is marked paid.
- **Settings**: phone, WhatsApp (used for both the footer and cart
  checkout messages), address, and BML/MIB account details.

## How checkout works

A customer adds items to their cart (stored in their browser), fills
in their name/phone/delivery address, and hits **Send order to
WhatsApp**. The order is saved on your side automatically, and they're
taken straight to WhatsApp with a pre-filled message listing every
item, the total, and their details — they just hit send.

## Adding more admin users later

Repeat step 1.3 in Supabase (**Authentication > Users > Add user**) —
no code changes needed.

## Custom domain: etronic.store

The site now points to **etronic.store**. If you ever need to redo this
(new registrar, domain expires and gets re-added, etc.), here's the
process:

1. In Railway, open this service → **Settings → Networking → Custom
   Domain** → enter `etronic.store` (and `www.etronic.store` if you
   want the www version too)
2. Railway gives you a CNAME record (or an A/ALIAS record for the
   root domain, depending on your registrar) — go to wherever
   `etronic.store` was bought, open its DNS settings, and add that
   record exactly as Railway shows it
3. Wait for DNS to propagate (usually 10 minutes to a few hours) —
   Railway will show the domain as verified once it's live
4. `metadataBase` in `src/app/layout.tsx` is already set to
   `https://etronic.store`, so link previews (WhatsApp, etc.) use the
   right URL out of the box

