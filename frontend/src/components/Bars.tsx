import React from 'react';
import { useInView } from '../lib/motion';

export interface BarItem {
  label: string;
  value: number;
  color?: string;
  detail?: string;
  /** Shown instead of the raw value, e.g. "2 h 10 min". */
  display?: string;
}

/** Plain horizontal bars: label, bar scaled to the largest value, number. Bars grow in when first seen. */
export const Bars: React.FC<{ items: BarItem[]; suffix?: string }> = ({ items, suffix = '' }) => {
  const max = Math.max(...items.map((i) => i.value), 1);
  const [ref, seen] = useInView<HTMLUListElement>();
  return (
    <ul ref={ref} className={`space-y-3 ${seen ? 'is-in' : ''}`}>
      {items.map((item, i) => (
        <li key={item.label} className="grid grid-cols-[minmax(5rem,9rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate">{item.label}</span>
          <span className="h-2.5 bg-rule/60">
            <span
              className="block h-full grow-x"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color ?? 'rgb(var(--ink))',
                transitionDelay: `${i * 50}ms`,
              }}
            />
          </span>
          <span className="text-right whitespace-nowrap">
            {item.display ?? item.value.toLocaleString()}
            {item.display ? '' : suffix}
            {item.detail && <span className="text-muted"> {item.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
};
