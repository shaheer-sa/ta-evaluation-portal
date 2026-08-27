"use client";

import AmbientField from "@/components/shell/AmbientField";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4"
      style={{
        backgroundColor: "var(--surface-0)",
        color: "var(--ink)",
        fontFamily: 'var(--font-body, "Inter", system-ui, sans-serif)',
      }}
    >
      <AmbientField />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "440px" }}>
        {children}
      </div>
    </div>
  );
}
