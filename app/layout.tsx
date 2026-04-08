import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Private Assistant",
  description: "Private personal assistant PWA",
  applicationName: "Private Assistant",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Private Assistant",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
