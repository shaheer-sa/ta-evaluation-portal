'use client';

import dynamic from 'next/dynamic';

// three.js is ~600kb — keep it out of the server bundle and off the critical path.
const LiquidEther = dynamic(() => import('@/components/react-bits/LiquidEther'), {
  ssr: false,
  loading: () => null
});

export default function AmbientBackground() {
  return (
    <div className="tams-ambient" aria-hidden="true">
      <LiquidEther
        colors={['#5227FF', '#A855F7', '#38BDF8']}
        mouseForce={16}
        cursorSize={120}
        resolution={0.35}
        autoDemo
        autoSpeed={0.35}
        autoIntensity={1.8}
        autoResumeDelay={2000}
      />
    </div>
  );
}
