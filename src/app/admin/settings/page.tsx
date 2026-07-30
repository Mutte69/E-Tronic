import { createClient } from "@/lib/supabase/server";
import { updateSettings } from "@/app/admin/actions";
import AdminNav from "@/components/AdminNav";
import SubmitButton from "@/components/SubmitButton";
import type { Settings } from "@/lib/types";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { saved?: string };
}) {
  const supabase = createClient();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
  const settings = data as Settings | null;

  return (
    <div className="min-h-screen">
      <AdminNav active="/admin/settings" />

      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10">
        <h1 className="font-display text-2xl mb-6">Settings</h1>

        {searchParams?.saved && (
          <p className="mb-6 font-body text-sm text-copper-bright bg-copper/10 border border-copper/30 rounded-md px-3 py-2 max-w-lg">
            Saved.
          </p>
        )}

        <form action={updateSettings} className="space-y-8 max-w-3xl">
          <fieldset className="space-y-4 max-w-lg">
            <legend className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright mb-2">
              Contact
            </legend>
            <Field label="Business name" name="business_name" defaultValue={settings?.business_name} />
            <Field
              label="Business registration number"
              name="registration_number"
              defaultValue={settings?.registration_number ?? ""}
            />
            <Field label="Phone number" name="phone" defaultValue={settings?.phone ?? ""} />
            <div>
              <Field
                label="WhatsApp number (also used for cart orders)"
                name="whatsapp"
                defaultValue={settings?.whatsapp ?? ""}
                mono
                placeholder="9607712345"
              />
              <p className="font-body text-[11px] text-muted mt-1">
                Country code first, no spaces, no + and no leading 0 — e.g.{" "}
                <span className="font-mono">9607712345</span> for a Maldivian number.
              </p>
            </div>
            <div>
              <label className="block font-body text-xs text-muted mb-1" htmlFor="address">
                Address
              </label>
              <textarea
                id="address"
                name="address"
                rows={2}
                defaultValue={settings?.address ?? ""}
                className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
              />
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright mb-2">
              Homepage content
            </legend>
            <Field
              label="Location line (small text above the headline)"
              name="hero_eyebrow"
              defaultValue={settings?.hero_eyebrow ?? "Male', Maldives"}
            />
            <TextAreaField
              label="Main headline"
              name="hero_heading"
              rows={2}
              defaultValue={settings?.hero_heading ?? "Electronics, sold and serviced right."}
            />
            <TextAreaField
              label="Subtext"
              name="hero_subtext"
              rows={3}
              defaultValue={
                settings?.hero_subtext ??
                "Devices, parts, and repairs from E Tronic. Reach out below for stock, pricing, or a service booking."
              }
            />

            <p className="font-body text-xs text-muted pt-2">
              "What we do" section — three cards shown under the headline.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Field
                  label="Card 1 title"
                  name="service_1_title"
                  defaultValue={settings?.service_1_title ?? "Sales"}
                />
                <TextAreaField
                  label="Card 1 text"
                  name="service_1_body"
                  rows={3}
                  defaultValue={
                    settings?.service_1_body ??
                    "New and quality electronics, priced fairly, with stock updated here as it comes in."
                  }
                />
              </div>
              <div className="space-y-2">
                <Field
                  label="Card 2 title"
                  name="service_2_title"
                  defaultValue={settings?.service_2_title ?? "Repair & service"}
                />
                <TextAreaField
                  label="Card 2 text"
                  name="service_2_body"
                  rows={3}
                  defaultValue={
                    settings?.service_2_body ??
                    "Diagnostics and repairs on the devices we sell and beyond — bring it in or message us the issue."
                  }
                />
              </div>
              <div className="space-y-2">
                <Field
                  label="Card 3 title"
                  name="service_3_title"
                  defaultValue={settings?.service_3_title ?? "Support"}
                />
                <TextAreaField
                  label="Card 3 text"
                  name="service_3_body"
                  rows={3}
                  defaultValue={
                    settings?.service_3_body ??
                    "Questions about a part, a price, or what fits your setup — reach out on WhatsApp any time."
                  }
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4 max-w-lg">
            <legend className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright mb-2">
              Invoices
            </legend>
            <Field
              label="Prepared by (shown on invoices)"
              name="invoice_prepared_by"
              defaultValue={settings?.invoice_prepared_by ?? "E Tronic Sales Team"}
            />
          </fieldset>

          <fieldset className="space-y-4 max-w-lg">
            <legend className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright mb-2">
              BML transfer
            </legend>
            <Field label="Account name" name="bml_account_name" defaultValue={settings?.bml_account_name ?? ""} />
            <Field label="Account number" name="bml_account_number" defaultValue={settings?.bml_account_number ?? ""} mono />
          </fieldset>

          <fieldset className="space-y-4 max-w-lg">
            <legend className="font-display text-sm tracking-[0.2em] uppercase text-copper-bright mb-2">
              MIB transfer
            </legend>
            <Field label="Account name" name="mib_account_name" defaultValue={settings?.mib_account_name ?? ""} />
            <Field label="Account number" name="mib_account_number" defaultValue={settings?.mib_account_number ?? ""} mono />
          </fieldset>

          <SubmitButton
            pendingText="Saving…"
            className="rounded-md bg-copper hover:bg-copper-bright transition-colors text-ink font-body text-sm font-medium px-5 py-2.5"
          >
            Save settings
          </SubmitButton>
        </form>
      </main>
    </div>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  rows = 3,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
}) {
  return (
    <div>
      <label className="block font-body text-xs text-muted mb-1" htmlFor={name}>
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-md bg-surface-raised border border-line px-3 py-2 font-body text-sm text-paper focus:border-copper outline-none"
      />
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  mono,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block font-body text-xs text-muted mb-1" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={`w-full rounded-md bg-surface-raised border border-line px-3 py-2 text-sm text-paper placeholder:text-muted/50 focus:border-copper outline-none ${
          mono ? "font-mono" : "font-body"
        }`}
      />
    </div>
  );
}
