import type { Settings } from "@/lib/types";

export default function Footer({ settings }: { settings: Settings | null }) {
  const hasBml = settings?.bml_account_number;
  const hasMib = settings?.mib_account_number;

  return (
    <footer id="contact" className="border-t border-line mt-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-14 grid gap-10 sm:grid-cols-2">
        <div>
          <p className="font-display text-sm tracking-[0.2em] text-copper-bright uppercase mb-3">
            Visit / Contact
          </p>
          <p className="font-body text-paper text-lg mb-1">
            {settings?.business_name ?? "E Tronic"}
          </p>
          {settings?.address && (
            <p className="font-body text-muted text-sm mb-1">{settings.address}</p>
          )}
          {settings?.phone && (
            <p className="font-mono text-sm text-paper mb-1">{settings.phone}</p>
          )}
          {settings?.whatsapp && (
            <a
              href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, "")}`}
              className="inline-block font-mono text-sm text-copper-bright hover:text-copper transition-colors"
            >
              WhatsApp: {settings.whatsapp}
            </a>
          )}
        </div>

        {(hasBml || hasMib) && (
          <div>
            <p className="font-display text-sm tracking-[0.2em] text-copper-bright uppercase mb-3">
              Bank Transfer
            </p>
            <div className="space-y-4">
              {hasBml && (
                <div className="border border-line rounded-md px-4 py-3 bg-surface">
                  <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">
                    BML
                  </p>
                  <p className="font-body text-sm text-paper">
                    {settings?.bml_account_name}
                  </p>
                  <p className="font-mono text-sm text-copper-bright">
                    {settings?.bml_account_number}
                  </p>
                </div>
              )}
              {hasMib && (
                <div className="border border-line rounded-md px-4 py-3 bg-surface">
                  <p className="font-body text-xs text-muted uppercase tracking-wide mb-1">
                    MIB
                  </p>
                  <p className="font-body text-sm text-paper">
                    {settings?.mib_account_name}
                  </p>
                  <p className="font-mono text-sm text-copper-bright">
                    {settings?.mib_account_number}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-line py-5 text-center font-mono text-xs text-muted">
        &copy; {new Date().getFullYear()} {settings?.business_name ?? "E Tronic"}
      </div>
    </footer>
  );
}
