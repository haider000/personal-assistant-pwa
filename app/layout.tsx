import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Private Assistant",
  description: "A private assistant for expenses, reminders, notes, and offline-first daily capture.",
  applicationName: "Private Assistant",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
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
      <body className="min-h-full bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
