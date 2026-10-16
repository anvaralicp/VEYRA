import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ExtensionCleanup } from "../components/extension-cleanup";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VEYRA — One Platform for a Smarter Business",
    template: "%s | VEYRA",
  },
  description:
    "Unify your customers, sales, projects and service operations in one connected SaaS platform. Simplify work, improve visibility and grow with VEYRA.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ExtensionCleanup />
        {children}
      </body>
    </html>
  );
}
