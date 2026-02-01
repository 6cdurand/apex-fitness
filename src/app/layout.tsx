import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SupabaseSync } from "@/components/SupabaseSync";
import { DevTools } from "@/components/DevTools";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Catalift | Ignite Your Rise",
  description: "The ultimate fitness tracking and personal training platform. Log workouts, track progress, connect with trainers, and achieve your goals.",
  keywords: ["fitness", "workout", "gym", "personal trainer", "strength training", "exercise", "catalift"],
  authors: [{ name: "Catalift" }],
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0c1929",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased bg-gray-950 text-white`}
      >
        {children}
        <SupabaseSync />
        <DevTools />
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
