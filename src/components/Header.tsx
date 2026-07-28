import Link from "next/link";

export default function Header() {
  return (
    <header className="border-b border-line bg-ink/95 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <EtronicMark />
          <span className="font-display text-lg tracking-tight text-paper">
            <span className="text-copper-bright">E</span>tronic
          </span>
        </Link>
        <nav className="flex items-center gap-6 font-body text-sm text-muted">
          <Link href="/#products" className="hover:text-paper transition-colors">
            Products
          </Link>
          <Link href="/#contact" className="hover:text-paper transition-colors">
            Contact
          </Link>
        </nav>
      </div>
    </header>
  );
}

function EtronicMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M62 12H24a8 8 0 0 0-8 8v60a8 8 0 0 0 8 8h38"
        stroke="#F5F3EE"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M22 50 L60 22"
        stroke="#F5F3EE"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="66" cy="18" r="7" fill="#F5F3EE" />
    </svg>
  );
}
