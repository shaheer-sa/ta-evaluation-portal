import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import "@/styles/tams-theme.css";
import "@/styles/react-bits.css";

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
    // Fonts are pulled in via @import in globals.css rather than <link> tags
    // here. The <link> approach tripped the Next.js `no-page-custom-font`
    // lint rule three times, and `next/font/google` needs to reach
    // fonts.googleapis.com at BUILD time, which breaks any offline or
    // network-restricted build. The CSS import fetches at runtime instead.
    <html lang="en" className="light" suppressHydrationWarning>
      <body
        className="min-h-screen bg-background font-sans text-foreground antialiased"
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
