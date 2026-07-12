import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MYSA OBJETS — Seçkili Yaşam Ürünleri",
  description: "Eviniz, gardırobunuz ve dostlarınız için zamansız, özenle seçilmiş yaşam ürünleri.",
  openGraph: {
    title: "MYSA OBJETS — Seçkili Yaşam Ürünleri",
    description: "Gündelik olanı olağanüstü kılın.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "MYSA OBJETS seçkili yaşam ürünleri" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MYSA OBJETS",
    description: "Gündelik olanı olağanüstü kılın.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
