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
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.35,
        }}
      >
        <LiquidEther
          colors={["#5227FF", "#A855F7", "#38BDF8"]}
          resolution={0.3}
          mouseForce={12}
          cursorSize={80}
          autoDemo
          autoSpeed={0.3}
          autoIntensity={1.4}
        />
      </div>

      {/* Vignette for readability */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "radial-gradient(120% 90% at 50% 40%, hsl(252 44% 5% / 0.15) 0%, hsl(252 44% 5% / 0.88) 70%), linear-gradient(180deg, hsl(252 44% 5% / 0.3), hsl(252 44% 5% / 0.92))",
        }}
      />

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
