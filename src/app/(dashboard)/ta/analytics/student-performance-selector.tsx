"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface StudentPerformanceSelectorProps {
  sections: { id: string; name: string }[];
  selectedId?: string;
}

export function StudentPerformanceSelector({ sections, selectedId }: StudentPerformanceSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    
    if (val) {
      params.set("sectionCourseId", val);
    } else {
      params.delete("sectionCourseId");
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <select
      value={selectedId || ""}
      onChange={handleSelect}
      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="" disabled>Select a section...</option>
      {sections.map((sec) => (
        <option key={sec.id} value={sec.id}>
          {sec.name}
        </option>
      ))}
    </select>
  );
}
