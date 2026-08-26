"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SpecularButton from "@/components/react-bits/SpecularButton";

const schema = z.object({
  identifier: z.string().min(1, "Enter your email or roll number"),
});

type ForgotPasswordForm = z.infer<typeof schema>;

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

const inputStyle: React.CSSProperties = {
  background: "var(--surface-sunk)",
  border: "1px solid var(--line)",
  borderRadius: "12px",
  color: "var(--ink)",
  fontSize: "0.9rem",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: ForgotPasswordForm) {
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const result = await res.json();
        toast.error(result.error || "Something went wrong");
        return;
      }

      setEmailSent(true);
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
      className="tams-auth-panel"
    >
      {emailSent ? (
        /* ── Success state ────────────────────────────────────── */
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{ textAlign: "center" }}
        >
          <motion.div variants={itemVariants}>
            <div
              style={{
                margin: "0 auto 1rem",
                width: "60px",
                height: "60px",
                borderRadius: "16px",
                display: "grid",
                placeItems: "center",
                background: "var(--success-soft)",
                border: "1px solid var(--success)",
              }}
            >
              <Mail style={{ width: 30, height: 30, color: "var(--success)" }} />
            </div>
          </motion.div>
          <motion.h1
            variants={itemVariants}
            style={{ fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.02em" }}
          >
            Check your email
          </motion.h1>
          <motion.p
            variants={itemVariants}
            style={{ marginTop: "0.5rem", fontSize: "0.88rem", color: "var(--ink-muted)" }}
          >
            If an account matches what you entered, you&apos;ll receive a
            password reset email shortly.
          </motion.p>
          <motion.div variants={itemVariants} style={{ marginTop: "1.5rem" }}>
            <Link
              href="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.85rem",
                color: "var(--primary)",
                textDecoration: "none",
              }}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              Back to sign in
            </Link>
          </motion.div>
        </motion.div>
      ) : (
        /* ── Form state ───────────────────────────────────────── */
        <>
          <motion.div variants={itemVariants} style={{ marginBottom: "1.5rem" }}>
            <Link
              href="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.78rem",
                color: "var(--ink-muted)",
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              Back to sign in
            </Link>
          </motion.div>

          <motion.div variants={itemVariants} style={{ marginBottom: "1.5rem" }}>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
              Reset your password
            </h1>
            <p style={{ marginTop: "0.4rem", fontSize: "0.88rem", color: "var(--ink-muted)" }}>
              Enter your email or roll number and we&apos;ll send you a reset link.
            </p>
          </motion.div>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <motion.div variants={itemVariants} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Label htmlFor="identifier" style={{ color: "var(--ink-muted)", fontSize: "0.85rem", fontWeight: 500 }}>
                Email or roll number
              </Label>
              <Input
                id="identifier"
                type="text"
                placeholder="you@university.edu or 24F-0538"
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
            </motion.div>

            <motion.div variants={itemVariants}>
              <SpecularButton
                type="submit"
                disabled={isLoading}
                block
                size="md"
                radius={14}
                tint="hsl(153 41% 19%)"
                tintOpacity={0.22}
                blur={10}
                textColor="hsl(26 59% 94%)"
                lineColor="#F9D2BA"
                baseColor="#1D4533"
                intensity={1.2}
                autoAnimate
                speed={0.3}
              >
                {isLoading ? (
                  <>
                    <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />
                    Sending…
                  </>
                ) : (
                  "Send reset link"
                )}
              </SpecularButton>
            </motion.div>
          </form>
        </>
      )}
    </motion.div>
  );
}
