import Link from "next/link";
import { signOut } from "@/app/admin/actions";

export default function AdminNav({ active }: { active: string }) {
  const links = [
    { href: "/admin", label: "Products" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/invoices", label: "Invoices" },
    { href: "/admin/analytics", label: "Analytics" },
    { href: "/admin/settings", label: "Settings" },
  ];

  return (
    <header className="border-b border-line">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between overflow-x-auto">
        <p className="font-display text-lg whitespace-nowrap">
          <span className="text-copper-bright">E</span>tronic{" "}
          <span className="text-muted font-body text-sm">admin</span>
        </p>
        <nav className="flex items-center gap-5 whitespace-nowrap">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`font-body text-sm transition-colors ${
                active === l.href
                  ? "text-copper-bright"
                  : "text-muted hover:text-paper"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/"
            className="font-body text-sm text-muted hover:text-paper transition-colors"
          >
            View site
          </Link>
          <form action={signOut}>
            <button className="font-body text-sm text-muted hover:text-copper-bright transition-colors">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
