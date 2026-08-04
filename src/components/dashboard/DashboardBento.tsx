'use client';

import { useRouter } from 'next/navigation';
import MagicBento, { BentoCard } from '@/components/react-bits/MagicBento';

export interface DashboardStats {
  students: number;
  sections: number;
  ungraded: number;
  openQueries: number;
  classAverage: number;
  weightCovered: number;
  termName: string;
}

export default function DashboardBento({ stats }: { stats: DashboardStats }) {
  const router = useRouter();

  // Card order drives the bento layout: index 2 is the hero tile,
  // index 3 the wide band. Put the number that matters most at index 2.
  const cards: (BentoCard & { href: string })[] = [
    {
      label: 'Roster',
      value: stats.students,
      title: 'Students enrolled',
      description: `Across ${stats.sections} active section${stats.sections === 1 ? '' : 's'}`,
      href: '/ta/students'
    },
    {
      label: 'Queries',
      value: stats.openQueries,
      title: 'Open queries',
      description: stats.openQueries > 0 ? 'Waiting on a reply from you' : 'Nothing waiting on you',
      delta: stats.openQueries > 0 ? 'needs reply' : 'clear',
      deltaTone: stats.openQueries > 0 ? 'down' : 'up',
      href: '/ta/queries'
    },
    {
      label: 'Grading',
      value: stats.ungraded,
      title: 'Submissions left to grade',
      description: 'Open the grading portal to work through the queue in one pass. Ungraded marks are excluded from averages until entered.',
      href: '/ta/grading'
    },
    {
      label: 'Performance',
      value: `${stats.classAverage.toFixed(1)}%`,
      title: 'Class average',
      description: `Computed over ${stats.weightCovered}% of total assessment weight`,
      href: '/ta/assessments'
    },
    {
      label: 'Sections',
      value: stats.sections,
      title: 'Sections you run',
      description: 'Rosters, timings and course links',
      href: '/ta/sections'
    },
    {
      label: 'Term',
      title: stats.termName,
      description: 'Active scope',
      href: '/ta/courses'
    }
  ];

  return (
    <MagicBento
      cards={cards}
      glowColor="132, 0, 255"
      spotlightRadius={360}
      particleCount={9}
      enableStars
      enableSpotlight
      enableBorderGlow
      enableMagnetism
      enableTilt={false}
      clickEffect
      onCardClick={(_card, index) => router.push(cards[index].href)}
    />
  );
}
