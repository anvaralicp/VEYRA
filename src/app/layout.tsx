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
  title: "VEYRA",
  description: "Next generation enterprise ERP & CRM",
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
