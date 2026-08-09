import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";

export const metadata: Metadata = {
  metadataBase: new URL("https://etronic.store"),
  title: "E Tronic — Electronics Sales & Service in Male', Maldives",
  description:
    "E Tronic — electronics sales and repair service in Male', Maldives. Devices, parts, and repairs.",
  keywords: [
    "E Tronic",
    "electronics Maldives",
    "electronics Male",
    "electronics repair Maldives",
    "meter box Maldives",
    "electronics store Male",
  ],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "E Tronic — Electronics Sales & Service in Male', Maldives",
    description:
      "E Tronic — electronics sales and repair service in Male', Maldives. Devices, parts, and repairs.",
    url: "https://etronic.store",
    siteName: "E Tronic",
    images: ["/etronic-mark.png"],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "E Tronic — Electronics Sales & Service in Male', Maldives",
    description:
      "E Tronic — electronics sales and repair service in Male', Maldives. Devices, parts, and repairs.",
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
