"use client";

import dynamic from "next/dynamic";

const LiquidEther = dynamic(
  () => import("@/components/react-bits/LiquidEther"),
  { ssr: false }
);

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
      {/* LiquidEther animated background */}
      <div className="tams-ambient" style={{ zIndex: 0 }}>
        <LiquidEther
          colors={['#1D4533', '#F9D2BA', '#5E3122']}
          resolution={0.4}
          mouseForce={28}
          cursorSize={110}
          isViscous={false}
          autoDemo={false}
          takeoverDuration={0.15}
          autoResumeDelay={3000}
          autoRampDuration={0.3}
        />
      </div>

      {/* Subtle grid overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          opacity: 0.15,
          backgroundImage:
            "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "440px" }}>
        {children}
      </div>
    </div>
  );
}
