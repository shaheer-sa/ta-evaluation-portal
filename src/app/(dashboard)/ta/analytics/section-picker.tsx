"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Option {
  id: string;
  label: string;
}

export function SectionPicker({ options }: { options: Option[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("sc") || "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    startTransition(() => {
      if (val) {
        router.push(`/ta/analytics?sc=${val}`);
      } else {
        router.push(`/ta/analytics`);
      }
    });
  }

  return (
    <div className="max-w-md flex items-center">
      <select
        value={current}
        onChange={onChange}
        className="tams-select"
        disabled={isPending}
      >
        <option value="">Select a section...</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
      {isPending && <span className="tams-select__pending">Loading…</span>}
    </div>
  );
}
