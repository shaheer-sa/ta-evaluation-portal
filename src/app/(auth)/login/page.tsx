"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GraduationCap, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import SpecularButton from "@/components/react-bits/SpecularButton";

// ── Schema ──────────────────────────────────────────────────────
const loginSchema = z.object({
  identifier: z
    .string()
    .min(1, "Email or roll number is required")
    .refine(
      (val) => {
        // Must be either a valid email or a non-empty string (roll number)
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

// ── Animations ──────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

// ── Component ───────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If the user lands here with a hash fragment from Supabase (e.g. from an un-redirected password reset link)
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
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{
        background: "hsl(252 40% 14% / 0.55)",
        border: "1px solid hsl(258 60% 78% / 0.14)",
        borderRadius: "18px",
        backdropFilter: "blur(18px) saturate(150%)",
        WebkitBackdropFilter: "blur(18px) saturate(150%)",
        boxShadow:
          "inset 0 1px 0 hsl(0 0% 100% / 0.05), 0 18px 48px hsl(252 60% 2% / 0.55)",
        padding: "2.5rem 2rem",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} style={{ marginBottom: "2rem", textAlign: "center" }}>
        <div
          style={{
            margin: "0 auto 1rem",
            width: "60px",
            height: "60px",
            borderRadius: "16px",
            display: "grid",
            placeItems: "center",
            background: "white",
            boxShadow: "0 4px 14px hsl(252 44% 5% / 0.5)",
          }}
        >
          <GraduationCap style={{ width: 30, height: 30, color: "hsl(252 44% 5%)" }} />
        </div>
        <h1
          style={{
            fontSize: "1.8rem",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            margin: 0,
            background: "linear-gradient(135deg, hsl(250 30% 96%), hsl(268 90% 76%))",
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
            color: "hsl(250 16% 68%)",
            letterSpacing: "0.01em",
          }}
        >
          Teaching Assistant Management System
        </p>
      </motion.div>

      {/* ── Form ───────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Identifier field */}
        <motion.div variants={itemVariants} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label
            htmlFor="identifier"
            style={{ color: "hsl(250 16% 68%)", fontSize: "0.85rem", fontWeight: 500 }}
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
            style={{
              background: "hsl(252 36% 11% / 0.7)",
              border: "1px solid hsl(258 60% 78% / 0.14)",
              borderRadius: "12px",
              color: "hsl(250 30% 96%)",
              fontSize: "0.9rem",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
            }}
            {...register("identifier")}
          />
          {errors.identifier && (
            <p style={{ fontSize: "0.75rem", color: "hsl(0 78% 63%)", margin: 0 }}>
              {errors.identifier.message}
            </p>
          )}
        </motion.div>

        {/* Password field */}
        <motion.div variants={itemVariants} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Label
              htmlFor="password"
              style={{ color: "hsl(250 16% 68%)", fontSize: "0.85rem", fontWeight: 500 }}
            >
              Password
            </Label>
            <Link
              href="/forgot-password"
              style={{
                fontSize: "0.75rem",
                color: "hsl(250 16% 68%)",
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
              style={{
                background: "hsl(252 36% 11% / 0.7)",
                border: "1px solid hsl(258 60% 78% / 0.14)",
                borderRadius: "12px",
                color: "hsl(250 30% 96%)",
                fontSize: "0.9rem",
                paddingRight: "2.5rem",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              }}
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
                color: "hsl(250 16% 68%)",
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
            <p style={{ fontSize: "0.75rem", color: "hsl(0 78% 63%)", margin: 0 }}>
              {errors.password.message}
            </p>
          )}
        </motion.div>

        {/* Submit */}
        <motion.div variants={itemVariants} style={{ marginTop: "0.5rem" }}>
          <SpecularButton
            type="submit"
            disabled={isLoading}
            block
            size="lg"
            radius={14}
            tint="hsl(268 90% 66%)"
            tintOpacity={0.22}
            blur={10}
            textColor="hsl(250 30% 96%)"
            lineColor="#a78bfa"
            baseColor="#5b3fa8"
            intensity={1.2}
            shineSize={14}
            shineFade={40}
            thickness={1.5}
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
        </motion.div>
      </form>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <motion.p
        variants={itemVariants}
        style={{
          marginTop: "1.75rem",
          textAlign: "center",
          fontSize: "0.75rem",
          color: "hsl(250 14% 50%)",
          lineHeight: 1.5,
        }}
      >
        Student accounts are created by the TA.
        <br />
        Contact your TA if you don&apos;t have an account.
      </motion.p>
    </motion.div>
  );
}
