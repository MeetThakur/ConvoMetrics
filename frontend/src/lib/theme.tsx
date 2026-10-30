import React, { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const systemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

/** Current theme plus a toggle. Follows the OS until the user picks one. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const set = document.documentElement.dataset.theme;
    return set === 'dark' || set === 'light' ? set : systemTheme();
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // storage unavailable; the choice just won't persist
    }
  }, [theme]);

  return [theme, toggle];
}

// Values come from CSS variables (see index.css) so charts follow light/dark mode.
export const INK = 'rgb(var(--ink))';
export const MUTED = 'rgb(var(--muted))';
export const RULE = 'rgb(var(--rule))';
export const ACCENT = 'rgb(var(--accent))';
export const CURSOR_FILL = 'rgb(var(--ink) / 0.06)';

// Per-participant colours, ordered so neighbours stay distinguishable.
export const PALETTE = [1, 2, 3, 4, 5, 6].map((n) => `rgb(var(--p${n}))`);

export const axisProps = {
  stroke: RULE,
  tickLine: false,
  tick: { fill: MUTED, fontSize: 11 },
} as const;

export const gridProps = {
  stroke: RULE,
  strokeDasharray: '2 4',
} as const;

interface TipProps {
  active?: boolean;
  payload?: any[];
  render: (row: any) => React.ReactNode;
}

/** Recharts tooltip body: a small ink label, no glass or glow. */
export const ChartTip: React.FC<TipProps> = ({ active, payload, render }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-ink text-paper px-3 py-2 text-xs leading-snug">
      {render(payload[0].payload)}
    </div>
  );
};
