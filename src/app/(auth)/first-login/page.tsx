"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SpecularButton from "@/components/react-bits/SpecularButton";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .refine((val) => !val.startsWith("Tams@"), {
        message: "Please choose a different password.",
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type FirstLoginForm = z.infer<typeof schema>;

const inputStyle: React.CSSProperties = {
  background: "var(--surface-sunk)",
  border: "1px solid var(--line)",
  borderRadius: "12px",
  color: "var(--ink)",
  fontSize: "0.9rem",
  paddingRight: "2.5rem",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

export default function FirstLoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FirstLoginForm>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FirstLoginForm) {
    setIsLoading(true);

    try {
      // Send password to the server route which updates password AND clears the flag
      const res = await fetch("/api/auth/complete-first-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: data.password }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.error || "Password changed, but your account could not be unlocked. Contact your TA.");
        setIsLoading(false);
        return;
      }

      toast.success("Password updated!");

      // 3. hard navigation so middleware re-reads the flag from scratch
      window.location.href = "/student";
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="tams-auth-panel animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
      <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
        <div
          style={{
            margin: "0 auto 1rem",
            width: "60px",
            height: "60px",
            borderRadius: "16px",
            display: "grid",
            placeItems: "center",
            background: "var(--primary-soft)",
            border: "1px solid var(--line-strong)",
          }}
        >
          <KeyRound style={{ width: 30, height: 30, color: "var(--navy)" }} />
        </div>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
          Set a new password
        </h1>
        <p style={{ marginTop: "0.4rem", fontSize: "0.88rem", color: "var(--ink-muted)" }}>
          Set your own password before continuing.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* New password */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="password" style={{ color: "var(--ink-muted)", fontSize: "0.85rem", fontWeight: 500 }}>
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
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                color: "var(--ink-faint)",
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <span style={{ fontSize: "0.8rem", color: "var(--danger)" }}>
              {errors.password.message}
            </span>
          )}
        </div>

        {/* Confirm password */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <Label htmlFor="confirmPassword" style={{ color: "var(--ink-muted)", fontSize: "0.85rem", fontWeight: 500 }}>
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
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                color: "var(--ink-faint)",
              }}
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <span style={{ fontSize: "0.8rem", color: "var(--danger)" }}>
              {errors.confirmPassword.message}
            </span>
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
            {isLoading ? <Loader2 className="animate-spin" size={18} /> : "Save & Continue"}
          </SpecularButton>
        </div>
        
        <div style={{ textAlign: "center" }}>
          <button
            type="button"
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--ink-muted)",
              fontSize: "0.85rem",
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: "4px"
            }}
          >
            Sign out
          </button>
        </div>
      </form>
    </div>
  );
}
