import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart-context";

export const metadata: Metadata = {
  title: "E Tronic — Electronics Sales & Service",
  description:
    "E Tronic — electronics sales and repair service in the Maldives.",
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
