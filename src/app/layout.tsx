import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
