import type { Metadata, Viewport } from "next";
import "./globals.css";

// Use system fonts as fallback (avoids Google Fonts network issues during build)
const poppins = {
  variable: "--font-poppins",
  className: "",
};

export const metadata: Metadata = {
  title: {
    default: "Smart Grid Monitor",
    template: "%s | Smart Grid Monitor",
  },
  icons: {
    icon: "/favicon-96x96.png",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  description: "Monitor and manage your smart grid effectively.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <link
        rel="icon"
        type="image/png"
        href="/favicon-96x96.png"
        sizes="96x96"
      />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="shortcut icon" href="/favicon.ico" />
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/apple-touch-icon.png"
      />
      <meta name="apple-mobile-web-app-title" content="Smart Grid Monitor" />
      <link rel="manifest" href="./manifest.json" />
      <body className={`${poppins.variable} antialiased`}>{children}</body>
    </html>
  );
}
