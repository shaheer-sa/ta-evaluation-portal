"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      className="glass-card rounded-2xl p-8 shadow-2xl"
    >
      {emailSent ? (
        /* ── Success state ────────────────────────────────────── */
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center"
        >
          <motion.div variants={itemVariants}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-green-500/10 ring-1 ring-green-500/20">
              <Mail className="h-7 w-7 text-green-400" />
            </div>
          </motion.div>
          <motion.h1
            variants={itemVariants}
            className="text-xl font-bold tracking-tight"
          >
            Check your email
          </motion.h1>
          <motion.p
            variants={itemVariants}
            className="mt-2 text-sm text-muted-foreground"
          >
            If an account matches what you entered, you&apos;ll receive a
            password reset email shortly.
          </motion.p>
          <motion.div variants={itemVariants} className="mt-6">
            <Link href="/login">
              <Button variant="ghost" className="text-sm">
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      ) : (
        /* ── Form state ───────────────────────────────────────── */
        <>
          <motion.div variants={itemVariants} className="mb-6">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-6">
            <h1 className="text-xl font-bold tracking-tight">
              Reset your password
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter your email or roll number and we&apos;ll send you a
              reset link.
            </p>
          </motion.div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <motion.div variants={itemVariants} className="space-y-2">
              <Label htmlFor="identifier">Email or roll number</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="you@university.edu or 24F-0538"
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

            <motion.div variants={itemVariants}>
              <Button
                id="forgot-password-submit"
                type="submit"
                className="h-11 w-full text-sm font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
            </motion.div>
          </form>
        </>
      )}
    </motion.div>
  );
}
