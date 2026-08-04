'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import ClickSpark from '@/components/react-bits/ClickSpark';
import LineSidebar from '@/components/react-bits/LineSidebar';
import AmbientBackground from '@/components/shell/AmbientBackground';
import { STUDENT_NAV, TA_NAV, activeIndexFor } from '@/components/shell/nav-config';

interface AppShellProps {
  role: 'ta' | 'student';
  /** shown under the wordmark, e.g. the signed-in name */
  userName?: string;
  /** page title in the top bar */
  title: string;
  /** right-hand side of the top bar: term switcher, sign out, etc. */
  actions?: ReactNode;
  children: ReactNode;
}

const MenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
  </svg>
);

const ChevronIcon = ({ flipped }: { flipped: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    style={{ transform: flipped ? 'rotate(180deg)' : undefined, transition: 'transform .25s ease' }}
  >
    <path d="M14 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function AppShell({ role, userName, title, actions, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const items = role === 'ta' ? TA_NAV : STUDENT_NAV;
  const labels = useMemo(() => items.map(i => i.label), [items]);
  const activeIndex = activeIndexFor(items, pathname ?? '');

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // remember the rail state between visits
  useEffect(() => {
    setCollapsed(window.localStorage.getItem('tams:rail-collapsed') === '1');
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      window.localStorage.setItem('tams:rail-collapsed', prev ? '0' : '1');
      return !prev;
    });
  };

  const go = (index: number) => {
    const target = items[index];
    if (target) router.push(target.href);
  };

  return (
    <ClickSpark sparkColor="hsl(268 90% 74%)" sparkRadius={17} sparkCount={8} duration={420}>
      <AmbientBackground />

      <div className="tams-shell">
        <aside
          className="tams-rail tams-glass tams-glass-strong"
          data-collapsed={collapsed ? 'true' : 'false'}
          data-open={drawerOpen ? 'true' : 'false'}
        >
          <div className="tams-rail__brand">
            <span className="tams-rail__mark">TA</span>
            {!collapsed && (
              <span>
                <span className="tams-rail__name">TAMS</span>
                <span className="tams-rail__role">{userName ?? (role === 'ta' ? 'Teaching assistant' : 'Student')}</span>
              </span>
            )}
          </div>

          <div className="tams-rail__nav">
            {collapsed ? (
              <div className="tams-rail__collapsed-nav">
                {items.map((item, i) => (
                  <button
                    key={item.href}
                    className="tams-rail__dot"
                    data-active={activeIndex === i ? 'true' : 'false'}
                    title={item.label}
                    aria-label={item.label}
                    onClick={() => go(i)}
                  >
                    {item.short}
                  </button>
                ))}
              </div>
            ) : (
              <LineSidebar
                items={labels}
                defaultActive={activeIndex}
                onItemClick={go}
                showIndex
                showMarker
                markerLength={30}
                itemGap={19}
                fontSize={0.95}
                maxShift={12}
                proximityRadius={105}
                accentColor="hsl(268 90% 70%)"
                textColor="hsl(250 16% 70%)"
                markerColor="hsl(250 14% 40%)"
                ariaLabel={role === 'ta' ? 'Teaching assistant navigation' : 'Student navigation'}
              />
            )}
          </div>

          <div className="tams-rail__footer">
            <button
              className="tams-iconbtn tams-desktop-only"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              <ChevronIcon flipped={collapsed} />
            </button>
          </div>
        </aside>

        {drawerOpen && (
          <button className="tams-scrim" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />
        )}

        <div className="tams-content">
          <header className="tams-topbar tams-glass tams-glass-strong">
            <button
              className="tams-iconbtn tams-mobile-only"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
            >
              <MenuIcon />
            </button>
            <span className="tams-topbar__title">{title}</span>
            <span className="tams-topbar__spacer" />
            {actions}
          </header>

          <main className="tams-main">{children}</main>
        </div>
      </div>
    </ClickSpark>
  );
}
