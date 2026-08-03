"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GraduationCap, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      className="glass-card rounded-2xl p-8 shadow-2xl"
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <motion.div variants={itemVariants} className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
          <GraduationCap className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-primary via-amber-400 to-primary bg-clip-text text-transparent">
            TAMS
          </span>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Teaching Assistant Management System
        </p>
      </motion.div>

      {/* ── Form ───────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Identifier field */}
        <motion.div variants={itemVariants} className="space-y-2">
          <Label htmlFor="identifier">Email or Roll Number</Label>
          <Input
            id="identifier"
            type="text"
            placeholder="e.g. ta@university.edu or 22F-1234"
            autoComplete="username"
            autoFocus
            disabled={isLoading}
            className="h-11 bg-background/50 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/10"
            {...register("identifier")}
          />
          {errors.identifier && (
            <p className="text-xs text-destructive">
              {errors.identifier.message}
            </p>
          )}
        </motion.div>

        {/* Password field */}
        <motion.div variants={itemVariants} className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground transition-colors hover:text-primary"
              tabIndex={-1}
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
              className="h-11 bg-background/50 pr-10 transition-shadow focus-visible:shadow-md focus-visible:shadow-primary/10"
              {...register("password")}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </motion.div>

        {/* Submit */}
        <motion.div variants={itemVariants}>
          <Button
            id="login-submit"
            type="submit"
            className="h-11 w-full text-sm font-semibold"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </motion.div>
      </form>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <motion.p
        variants={itemVariants}
        className="mt-6 text-center text-xs text-muted-foreground"
      >
        Student accounts are created by the TA.
        <br />
        Contact your TA if you don&apos;t have an account.
      </motion.p>
    </motion.div>
  );
}
