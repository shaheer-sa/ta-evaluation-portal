"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { GraduationCap, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import SpecularButton from "@/components/react-bits/SpecularButton";
import { GlobalSpotlight, ParticleCard } from "@/components/react-bits/MagicBento";
// ── Schema ──────────────────────────────────────────────────────
const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Email or roll number is required")
    .refine(
      (val) => {
        if (val.includes("@")) {
          return z.string().email().safeParse(val).success;
        }
        return val.trim().length > 0;
      },
      { message: "Enter a valid email or roll number" }
    ),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

const inputStyle: React.CSSProperties = {
  background: "var(--surface-sunk)",
  border: "1px solid var(--line)",
  borderRadius: "12px",
  color: "var(--ink)",
  fontSize: "0.9rem",
  paddingRight: "2.5rem",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

// ── Component ───────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    setCanHover(
      window.matchMedia("(hover: hover)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("access_token=")) {
      setIsLoading(true);
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          router.push("/reset-password");
        } else {
          setIsLoading(false);
        }
      });
    }
  }, [router]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const identifierValue = watch("identifier");
  const passwordValue = watch("password");

  async function onSubmit(data: LoginForm) {
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result.error || "Login failed");
        return;
      }

      toast.success("Welcome back!");
      router.push(result.role === "ta" ? "/ta" : "/student");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="mc-section w-full"
      ref={gridRef}
      style={{ "--mc-glow": "10, 41, 71" } as React.CSSProperties}
    >
      {canHover && (
        <GlobalSpotlight gridRef={gridRef} glowColor="10, 41, 71" spotlightRadius={300} />
      )}
      <ParticleCard
        className="mc-card mc-card--glow tams-auth-panel animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out"
        particleCount={0}
        enableTilt={true}
        enableMagnetism={false}
        clickEffect={false}
        disableAnimations={!canHover}
      >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: "2rem", textAlign: "center" }}>
        <div
          style={{
            margin: "0 auto 1rem",
            width: "60px",
            height: "60px",
            borderRadius: "16px",
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(145deg, var(--navy), hsl(210 75% 12%))",
            border: "1px solid hsl(153 41% 19% / 0.7)",
            boxShadow: "0 0 16px hsl(153 41% 19% / 0.25), inset 0 1px 2px hsl(0 0% 100% / 0.2)",
          }}
        >
          <GraduationCap style={{ width: 30, height: 30, color: "var(--primary-fg)" }} />
        </div>
        <h1
          style={{
            fontSize: "1.8rem",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            margin: 0,
            background: "linear-gradient(135deg, var(--navy), var(--slate))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          TAMS
        </h1>
        <p
          style={{
            marginTop: "0.4rem",
            fontSize: "0.88rem",
            color: "var(--ink-muted)",
            letterSpacing: "0.01em",
          }}
        >
          Teaching Assistant Management System
        </p>
      </div>

      {/* ── Form ───────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Identifier field */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label
            htmlFor="identifier"
            style={{ color: "var(--ink-muted)", fontSize: "0.85rem", fontWeight: 500 }}
          >
            Email or Roll Number
          </Label>
          <Input
            id="identifier"
            type="text"
            placeholder="e.g. ta@university.edu or 22F-1234"
            autoComplete="username"
            autoFocus
            disabled={isLoading}
            className="h-11"
            style={inputStyle}
            {...register("identifier")}
          />
          {errors.identifier && (
            <p style={{ fontSize: "0.75rem", color: "var(--danger)", margin: 0 }}>
              {errors.identifier.message}
            </p>
          )}
        </div>

        {/* Password field */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Label
              htmlFor="password"
              style={{ color: "var(--ink-muted)", fontSize: "0.85rem", fontWeight: 500 }}
            >
              Password
            </Label>
            <Link
              href="/forgot-password"
              style={{
                fontSize: "0.75rem",
                color: "var(--ink-muted)",
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              tabIndex={-1}
            >
              Forgot password?
            </Link>
          </div>
          <div style={{ position: "relative" }}>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
              className="h-11"
              style={inputStyle}
              {...register("password")}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                transition: "color 0.2s ease",
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff style={{ width: 16, height: 16 }} />
              ) : (
                <Eye style={{ width: 16, height: 16 }} />
              )}
            </button>
          </div>
          {errors.password && (
            <p style={{ fontSize: "0.75rem", color: "var(--danger)", margin: 0 }}>
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <div style={{ marginTop: "0.5rem" }}>
          <SpecularButton
            type="submit"
            disabled={isLoading || !identifierValue || !passwordValue}
            block
            size="lg"
            radius={14}
            tint="hsl(210 75% 16%)"
            tintOpacity={1}
            blur={10}
            textColor="hsl(40 55% 97%)"
            lineColor="#F3E4C9"
            baseColor="#0A2947"
            intensity={2.4}
            shineSize={26}
            shineFade={40}
            thickness={2}
            autoAnimate
            speed={0.3}
          >
            {isLoading ? (
              <>
                <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </SpecularButton>
        </div>
      </form>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <p
        style={{
          marginTop: "1.75rem",
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--ink-faint)",
          lineHeight: 1.5,
        }}
      >
        Student accounts are created by the TA.
        <br />
        Contact your TA if you don&apos;t have an account.
      </p>
      </ParticleCard>
    </div>
  );
}
