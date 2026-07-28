# E Tronic website

Next.js site + admin dashboard for E Tronic. Public site shows products
(featured ones on top), contact info, and bank transfer details. The
admin dashboard (`/admin`) lets your brother log in and manage all of it
himself — no code required after setup.

## 1. Create a Supabase project (free tier is enough)

1. Go to https://supabase.com, sign up, and create a new project.
2. Once it's ready, open **SQL Editor > New query**, paste in the
   contents of `supabase/schema.sql` from this repo, and run it. This
   creates the `products` table, `settings` table, and the storage
   bucket for photos.
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

- Log in at `/admin/login` with the email/password created in step 1.
- **Add product**: photo, name, short description, price, and a
  "Show as featured" toggle — featured items appear in their own row
  at the top of the homepage.
- **Settings**: phone, WhatsApp, address, and BML/MIB account details
  shown in the site footer.
- Toggle "Featured" / "In stock" or remove a product straight from the
  product list — no separate edit step needed for those.

## Adding more admin users later

Repeat step 1.3 in Supabase (**Authentication > Users > Add user**) —
no code changes needed.
