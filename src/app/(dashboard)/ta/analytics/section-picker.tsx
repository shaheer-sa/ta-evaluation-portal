"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";

export interface PickerOption {
  id: string;
  section: string;
  code: string;
  name: string;
}

export function SectionPicker({ options }: { options: PickerOption[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("sc") || "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    startTransition(() => {
      router.push(val ? `/ta/analytics?sc=${val}` : "/ta/analytics");
    });
  }

  return (
    <div className="w-full max-w-md space-y-1.5">
      <label
        htmlFor="analytics-class"
        className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
      >
        Class
      </label>
      <div className="relative">
        <select
          id="analytics-class"
          value={current}
          onChange={onChange}
          disabled={isPending || options.length === 0}
          aria-busy={isPending}
          className="h-11 w-full cursor-pointer appearance-none rounded-lg border border-input bg-card pl-3.5 pr-10 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
        >
          <option value="">
            {options.length === 0 ? "No classes in this term" : "Choose a section and course…"}
          </option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {`Section ${opt.section} — ${opt.name || opt.code} (${opt.code})`}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {isPending ? "Loading this class…" : `${options.length} ${options.length === 1 ? "class" : "classes"} this term`}
      </p>
    </div>
  );
}
