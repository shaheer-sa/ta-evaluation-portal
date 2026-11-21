import type { Metadata, Viewport } from "next";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import { ThemedToaster } from "@/components/themed-toaster";
import { InstallWatch } from "@/components/install-watch";
import { themeInitScript } from "@/lib/theme";

import "@/styles/tokens.css";
import "./globals.css";
import "@/styles/tams-theme.css";
import "@/styles/react-bits.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
// only used for numbers in tables, so it isn't preloaded with every page
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jet", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "TAMS — Teaching Assistant Management System",
  description:
    "Course management, marks tracking, and student communication for teaching assistants.",
  applicationName: "TAMS",
  icons: { apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }] },
  appleWebApp: { capable: true, title: "TAMS", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0A2947",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className="min-h-screen font-sans text-foreground antialiased"
        suppressHydrationWarning
      >
        {children}
        <ThemedToaster />
        <InstallWatch />
      </body>
    </html>
  );
}
