import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — TAMS",
  description: "Sign in to the Teaching Assistant Management System.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `dark` scopes the dark CSS variables to this subtree only. The auth
    // screens are designed dark (gradient backdrop + glass card) while the
    // dashboard is light — without this, light-mode `--foreground` renders
    // near-black text on the near-black glass card.
    <div className="dark auth-gradient relative flex min-h-screen items-center justify-center overflow-hidden px-4 text-foreground">
      {/* Decorative background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl animate-float" />
        <div
          className="absolute -bottom-48 -right-48 h-[30rem] w-[30rem] rounded-full bg-primary/5 blur-3xl animate-float"
          style={{ animationDelay: "3s" }}
        />
        <div
          className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-500/5 blur-3xl animate-float"
          style={{ animationDelay: "1.5s" }}
        />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(210 40% 96%) 1px, transparent 1px), linear-gradient(90deg, hsl(210 40% 96%) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
