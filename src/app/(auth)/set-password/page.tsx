"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SpecularButton from "@/components/react-bits/SpecularButton";
import { ParticleCard, GlobalSpotlight } from "@/components/react-bits/MagicBento";
import { clearMustChangePasswordFlag } from "./actions";

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

type SetPasswordForm = z.infer<typeof schema>;

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
  background: "hsl(252 36% 11% / 0.7)",
  border: "1px solid hsl(258 60% 78% / 0.14)",
  borderRadius: "12px",
  color: "hsl(250 30% 96%)",
  fontSize: "0.9rem",
  paddingRight: "2.5rem",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

export default function SetPasswordPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SetPasswordForm>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: SetPasswordForm) {
    setIsLoading(true);

    try {
      const supabase = createClient();
      
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        toast.error("You must be logged in to change your password.");
        return;
      }

      // Update auth password
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      // Clear the must_change_password flag securely via server action
      try {
        await clearMustChangePasswordFlag();
      } catch (err: any) {
        toast.error("Password updated, but failed to update profile status.");
        return;
      }

      toast.success("Account secured! Redirecting to dashboard…");

      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div ref={gridRef} className="mc-section w-full" style={{ '--mc-glow': '245, 163, 10' } as any}>
      <GlobalSpotlight gridRef={gridRef} glowColor="245, 163, 10" />
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <ParticleCard
          className="mc-card mc-card--glow"
          enableTilt={true}
          clickEffect={true}
          particleCount={15}
          style={{
            padding: "2.5rem 2rem",
            background: "hsl(252 40% 14% / 0.55)",
            backdropFilter: "blur(18px) saturate(150%)",
            WebkitBackdropFilter: "blur(18px) saturate(150%)",
            boxShadow:
              "inset 0 1px 0 hsl(0 0% 100% / 0.05), 0 18px 48px hsl(252 60% 2% / 0.55)",
          }}
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
              Welcome! Secure your account
            </h1>
            <p style={{ marginTop: "0.4rem", fontSize: "0.88rem", color: "hsl(250 16% 68%)" }}>
              Please change your temporary password to continue.
            </p>
          </motion.div>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
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
                    Saving…
                  </>
                ) : (
                  "Save and continue"
                )}
              </SpecularButton>
            </motion.div>
          </form>
        </ParticleCard>
      </motion.div>
    </div>
  );
}
