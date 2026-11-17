import React from 'react';
import { Count, Reveal } from '../lib/motion';

export interface Stat {
  label: string;
  /** Numbers count up; strings are shown as-is. */
  value: number | string;
  decimals?: number;
  suffix?: string;
  unit?: string;
  detail?: string;
}

interface StatGridProps {
  stats: Stat[];
  /** Tailwind column count at the sm breakpoint. */
  cols?: 2 | 3 | 4 | 5;
  size?: 'lg' | 'md';
  className?: string;
}

const COLS = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4', 5: 'sm:grid-cols-5' };

/** A ruled row of headline numbers. Numbers count up the first time they scroll into view. */
export const StatGrid: React.FC<StatGridProps> = ({ stats, cols = 4, size = 'md', className = '' }) => (
  <dl className={`grid grid-cols-2 ${COLS[cols]} border-y border-ink ${className}`}>
    {stats.map((s, i) => (
      <Reveal key={s.label} delay={i} className={`py-5 px-4 first:pl-0 ${i > 0 ? 'sm:border-l border-rule' : ''}`}>
        <dt className="text-xs uppercase tracking-wider text-muted mb-1">{s.label}</dt>
        <dd className={`font-display ${size === 'lg' ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'} leading-none`}>
          {typeof s.value === 'number' ? (
            <Count value={s.value} decimals={s.decimals} suffix={s.suffix} />
          ) : (
            s.value
          )}
          {s.unit && <span className="font-sans text-sm text-muted ml-1.5">{s.unit}</span>}
        </dd>
        {s.detail && <dd className="mt-1.5 text-sm text-muted">{s.detail}</dd>}
      </Reveal>
    ))}
  </dl>
);
