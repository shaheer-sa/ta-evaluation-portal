"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetch-json";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SpecularButton from "@/components/react-bits/SpecularButton";

const schema = z.object({
  identifier: z.string().min(1, "Enter your email or roll number"),
});

type ForgotPasswordForm = z.infer<typeof schema>;


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
      await fetchJson("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      setEmailSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="tams-auth-panel animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      {emailSent ? (
        /* ── Success state ────────────────────────────────────── */
        <div style={{ textAlign: "center" }}>
          <div>
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
          </div>
          <h1>
            Check your email
          </h1>
          <p>
            If an account matches what you entered, you&apos;ll receive a
            password reset email shortly.
          </p>
          <div>
            <Link
              href="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.85rem",
                color: "var(--navy)",
                textDecoration: "none",
              }}
            >
              <ArrowLeft style={{ width: 14, height: 14 }} />
              Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        /* ── Form state ───────────────────────────────────────── */
        <>
          <div>
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
          </div>

          <div>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
              Reset your password
            </h1>
            <p style={{ marginTop: "0.4rem", fontSize: "0.88rem", color: "var(--ink-muted)" }}>
              Enter your email or roll number and we&apos;ll send you a reset link.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
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
            </div>

            <div>
              <SpecularButton
                type="submit"
                disabled={isLoading}
                block
                size="md"
                radius={14}
                tint="hsl(210 75% 16%)"
                tintOpacity={1}
                blur={10}
                textColor="hsl(40 55% 97%)"
                lineColor="#F3E4C9"
                baseColor="#0A2947"
                intensity={2.4}
                shineSize={26}
                thickness={2}
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
            </div>
          </form>
        </>
      )}
    </div>
  );
}
