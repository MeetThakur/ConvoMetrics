import React from 'react';

export interface BarItem {
  label: string;
  value: number;
  color?: string;
  detail?: string;
}

/** Plain horizontal bars: label, bar scaled to the largest value, number. */
export const Bars: React.FC<{ items: BarItem[]; suffix?: string }> = ({ items, suffix = '' }) => {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.label} className="grid grid-cols-[minmax(5rem,9rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate">{item.label}</span>
          <span className="h-2.5 bg-rule/60">
            <span
              className="block h-full"
              style={{
                width: `${(item.value / max) * 100}%`,
                backgroundColor: item.color ?? 'rgb(var(--ink))',
              }}
            />
          </span>
          <span className="text-right">
            {item.value.toLocaleString()}
            {suffix}
            {item.detail && <span className="text-muted"> {item.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
};
