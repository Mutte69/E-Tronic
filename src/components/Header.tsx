import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header className="border-b border-line bg-ink/95 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="relative w-32 h-8 shrink-0" aria-label="E Tronic">
          <Image
            src="/etronic-logo.png"
            alt="E Tronic"
            fill
            className="object-contain object-left"
            priority
          />
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
