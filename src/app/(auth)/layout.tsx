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
      className="dark relative flex min-h-screen items-center justify-center overflow-hidden px-4"
      style={{
        backgroundColor: "hsl(252 44% 5%)",
        color: "hsl(250 30% 96%)",
        fontFamily: 'var(--font-body, "Inter", system-ui, sans-serif)',
      }}
    >
      {/* LiquidEther animated background */}
      <div className="tams-ambient" style={{ zIndex: 0 }}>
        <LiquidEther
          colors={['#f59e0b', '#ec4899', '#8b5cf6']}
          resolution={0.6}
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
          opacity: 0.03,
          backgroundImage:
            "linear-gradient(hsl(268 90% 76% / 0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(268 90% 76% / 0.4) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "440px" }}>
        {children}
      </div>
    </div>
  );
}
