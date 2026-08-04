"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SpecularButton from "@/components/react-bits/SpecularButton";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Must include uppercase, lowercase, and a number"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ResetPasswordForm = z.infer<typeof schema>;

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

const glassStyle: React.CSSProperties = {
  background: "hsl(252 40% 14% / 0.55)",
  border: "1px solid hsl(258 60% 78% / 0.14)",
  borderRadius: "18px",
  backdropFilter: "blur(18px) saturate(150%)",
  WebkitBackdropFilter: "blur(18px) saturate(150%)",
  boxShadow:
    "inset 0 1px 0 hsl(0 0% 100% / 0.05), 0 18px 48px hsl(252 60% 2% / 0.55)",
  padding: "2.5rem 2rem",
};

const inputStyle: React.CSSProperties = {
  background: "hsl(252 36% 11% / 0.7)",
  border: "1px solid hsl(258 60% 78% / 0.14)",
  borderRadius: "12px",
  color: "hsl(250 30% 96%)",
  fontSize: "0.9rem",
  paddingRight: "2.5rem",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // This page is reachable with no auth guard at the middleware level
  // (the recovery-link flow lands here right after exchanging its
  // code for a session, before middleware would otherwise treat this
  // request as "logged in"). That means it's on this component to
  // confirm a real session actually exists before letting anyone
  // submit a new password — otherwise supabase.auth.updateUser() just
  // fails, but with no explanation, for anyone who opens this URL
  // directly without a valid recovery session.
  const [sessionState, setSessionState] = useState<
    "checking" | "valid" | "missing"
  >("checking");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionState(session ? "valid" : "missing");
    });
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: ResetPasswordForm) {
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password updated! Redirecting to sign in…");

      // Sign out so they have to log in with the new password
      await supabase.auth.signOut();

      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 1500);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (sessionState === "checking") {
    return (
      <div
        style={{
          ...glassStyle,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <Loader2 style={{ width: 24, height: 24, color: "hsl(250 16% 68%)", animation: "spin 1s linear infinite" }} />
        <p style={{ fontSize: "0.88rem", color: "hsl(250 16% 68%)" }}>Verifying your link…</p>
      </div>
    );
  }

  if (sessionState === "missing") {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ ...glassStyle, textAlign: "center" }}
      >
        <div
          style={{
            margin: "0 auto 1rem",
            width: "60px",
            height: "60px",
            borderRadius: "16px",
            display: "grid",
            placeItems: "center",
            background: "hsl(0 78% 63% / 0.12)",
            border: "1px solid hsl(0 78% 63% / 0.25)",
          }}
        >
          <ShieldAlert style={{ width: 30, height: 30, color: "hsl(0 78% 63%)" }} />
        </div>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
          This link isn&apos;t valid
        </h1>
        <p style={{ marginTop: "0.5rem", fontSize: "0.88rem", color: "hsl(250 16% 68%)" }}>
          Your password reset link may have expired or already been used.
          Request a new one to continue.
        </p>
        <div style={{ marginTop: "1.5rem" }}>
          <Link href="/forgot-password">
            <SpecularButton
              block
              size="md"
              radius={14}
              tint="hsl(268 90% 66%)"
              tintOpacity={0.22}
              blur={10}
              textColor="hsl(250 30% 96%)"
              lineColor="#a78bfa"
              baseColor="#5b3fa8"
              autoAnimate
              speed={0.3}
            >
              Request a new link
            </SpecularButton>
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={glassStyle}
    >
      <motion.div variants={itemVariants} style={{ marginBottom: "1.5rem", textAlign: "center" }}>
        <div
          style={{
            margin: "0 auto 1rem",
            width: "60px",
            height: "60px",
            borderRadius: "16px",
            display: "grid",
            placeItems: "center",
            background: "linear-gradient(145deg, hsl(268 90% 66% / 0.15), hsl(199 89% 62% / 0.12))",
            border: "1px solid hsl(268 90% 66% / 0.25)",
          }}
        >
          <KeyRound style={{ width: 30, height: 30, color: "hsl(268 90% 76%)" }} />
        </div>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
          Set a new password
        </h1>
        <p style={{ marginTop: "0.4rem", fontSize: "0.88rem", color: "hsl(250 16% 68%)" }}>
          Choose a strong password for your account.
        </p>
      </motion.div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* New password */}
        <motion.div variants={itemVariants} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="password" style={{ color: "hsl(250 16% 68%)", fontSize: "0.85rem", fontWeight: 500 }}>
            New password
          </Label>
          <div style={{ position: "relative" }}>
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              autoFocus
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
                color: "hsl(250 16% 68%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
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

        {/* Confirm password */}
        <motion.div variants={itemVariants} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="confirmPassword" style={{ color: "hsl(250 16% 68%)", fontSize: "0.85rem", fontWeight: 500 }}>
            Confirm password
          </Label>
          <div style={{ position: "relative" }}>
            <Input
              id="confirmPassword"
              type={showConfirm ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              disabled={isLoading}
              className="h-11"
              style={inputStyle}
              {...register("confirmPassword")}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm(!showConfirm)}
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
              }}
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? (
                <EyeOff style={{ width: 16, height: 16 }} />
              ) : (
                <Eye style={{ width: 16, height: 16 }} />
              )}
            </button>
          </div>
          {errors.confirmPassword && (
            <p style={{ fontSize: "0.75rem", color: "hsl(0 78% 63%)", margin: 0 }}>
              {errors.confirmPassword.message}
            </p>
          )}
        </motion.div>

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
            autoAnimate
            speed={0.3}
          >
            {isLoading ? (
              <>
                <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
                Updating…
              </>
            ) : (
              "Update password"
            )}
          </SpecularButton>
        </motion.div>
      </form>
    </motion.div>
  );
}
