"use client";

import Link from "next/link";
import { useRef } from "react";
import { ChevronDown } from "lucide-react";
import { ParticleCard, GlobalSpotlight } from "@/components/react-bits/MagicBento";

export interface CourseGrade {
  id: string; // Used for linking
  code: string;
  title: string;
  percentage: number;
  term: string;
  section: string;
  gradedCount: number;
  totalCount: number;
  weightCovered: number;
  breakdown?: { label: string; score: number; max: number }[];
}

export function GradesGrid({ children }: { children: React.ReactNode }) {
  const gridRef = useRef<HTMLDivElement>(null);
  return (
    <section className="mc-section w-full" style={{ '--mc-glow': '211, 212, 192' } as React.CSSProperties}>
      <GlobalSpotlight gridRef={gridRef} glowColor="211, 212, 192" />
      <div ref={gridRef} className="w-full">
        {children}
      </div>
    </section>
  );
}

// ---- Stat Strip ----
function StatTile({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const content = (
    <ParticleCard 
      className="mc-card mc-card--glow h-full p-6 flex flex-col justify-center tams-card" 
      enableTilt={true}
      clickEffect={true}
      particleCount={6}
    >
      <div className="relative z-10">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
          {label}
        </p>
        <p className="text-3xl font-bold text-foreground">{value}</p>
      </div>
    </ParticleCard>
  );

  return href ? (
    <Link href={href} className="tams-stat" style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}>
      {content}
    </Link>
  ) : (
    content
  );
}

export function StatStrip({
  overall,
  courseCount,
  pendingQueries,
}: {
  overall: string;
  courseCount: number;
  pendingQueries: number;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 w-full">
      <StatTile label="Overall Standing" value={overall} href="/student" />
      <StatTile label="Courses Enrolled" value={courseCount} href="/student" />
      <StatTile label="Pending Queries" value={pendingQueries} href="/student/queries" />
    </div>
  );
}

// ---- Upgraded Grade Card ----
function ProgressRing({ percentage }: { percentage: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;

  return (
    <svg width="100" height="100" className="-rotate-90 shrink-0">
      <circle
        cx="50"
        cy="50"
        r={radius}
        stroke="var(--line)"
        strokeWidth="8"
        fill="none"
      />
      <circle
        cx="50"
        cy="50"
        r={radius}
        stroke="url(#gradeGradient)"
        strokeWidth="8"
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
      <defs>
        <linearGradient id="gradeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0A2947" />
          <stop offset="100%" stopColor="#2D5276" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MiniBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-muted-foreground truncate mr-2" title={label}>{label}</span>
        <span className="text-foreground font-medium shrink-0">
          {score}/{max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function GradeCard({ course }: { course: CourseGrade }) {
  return (
    <Link href={`/student/course/${course.id}`} className="block h-full cursor-pointer">
      <ParticleCard 
        className="mc-card mc-card--glow h-full p-8 flex flex-col group relative overflow-hidden transition-all hover:-translate-y-1 tams-card" 
        enableTilt={true}
        particleCount={15}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start gap-6">
          <ProgressRing percentage={course.percentage} />

          <div className="flex-1 min-w-0 mt-2 sm:mt-0">
            <div className="flex justify-between items-start">
              <p className="text-sm uppercase tracking-wider text-muted-foreground mb-1 font-medium">
                {course.code}
              </p>
              <ChevronDown size={18} strokeWidth={1.5} className="tams-expand-icon" />
            </div>
            <p className="text-4xl font-bold text-foreground mb-2 tracking-tight">
              {course.percentage}%
            </p>
            <h3 className="text-lg font-semibold text-foreground truncate">
              {course.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {course.term} · Section {course.section}
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-auto pt-6 border-t border-border flex-grow flex flex-col justify-end">
          <div className="flex items-center justify-between text-sm mb-4 mt-2">
            <span className="text-muted-foreground">
              {course.gradedCount} of {course.totalCount} graded
            </span>
            <span className="text-primary font-medium">
              {course.weightCovered}% weight covered
            </span>
          </div>

          {course.breakdown && course.breakdown.length > 0 && (
            <div className="mt-2 space-y-1">
              {course.breakdown.map((b) => (
                <MiniBar key={b.label} {...b} />
              ))}
            </div>
          )}
        </div>
      </ParticleCard>
    </Link>
  );
}
