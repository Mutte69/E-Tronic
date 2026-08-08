import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";

export const metadata: Metadata = {
  metadataBase: new URL("https://etronic.store"),
  title: "E Tronic — Electronics Sales & Service",
  description:
    "E Tronic — electronics sales and repair service in the Maldives.",
  openGraph: {
    title: "E Tronic — Electronics Sales & Service",
    description:
      "E Tronic — electronics sales and repair service in the Maldives.",
    images: ["/etronic-mark.png"],
  },
  twitter: {
    card: "summary",
    title: "E Tronic — Electronics Sales & Service",
    description:
      "E Tronic — electronics sales and repair service in the Maldives.",
    images: ["/etronic-mark.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-body bg-ink text-paper min-h-screen">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
