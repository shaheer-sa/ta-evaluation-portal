import type { Metadata } from "next";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

import "@/styles/tokens.css";
import "./globals.css";
import "@/styles/tams-theme.css";
import "@/styles/react-bits.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jet", display: "swap" });

export const metadata: Metadata = {
  title: "TAMS — Teaching Assistant Management System",
  description:
    "Course management, marks tracking, and student communication for teaching assistants.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${mono.variable}`} suppressHydrationWarning>
      <body
        className="min-h-screen font-sans text-foreground antialiased"
        suppressHydrationWarning
      >
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ duration: 4000 }}
        />
      </body>
    </html>
  );
}
