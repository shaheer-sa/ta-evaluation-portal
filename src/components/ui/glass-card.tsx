import { ReactNode } from 'react';

interface GlassCardProps {
  title?: string;
  hint?: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** removes inner padding — use when the card holds a full-bleed table */
  flush?: boolean;
}

export default function GlassCard({
  title,
  hint,
  eyebrow,
  actions,
  children,
  className = '',
  flush = false
}: GlassCardProps) {
  return (
    <section className={`tams-glass tams-card ${className}`} style={flush ? { padding: 0 } : undefined}>
      {(title || actions || eyebrow) && (
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: flush ? '1.15rem 1.25rem 0.9rem' : undefined,
            marginBottom: flush ? 0 : '0.9rem'
          }}
        >
          <div>
            {eyebrow && <p className="tams-eyebrow" style={{ margin: '0 0 0.35rem' }}>{eyebrow}</p>}
            {title && <h2 className="tams-card__title">{title}</h2>}
            {hint && <p className="tams-card__hint">{hint}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
