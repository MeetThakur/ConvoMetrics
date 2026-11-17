import React, { useMemo, useState } from 'react';
import { DailyPoint } from '../types';
import { useInView } from '../lib/motion';
import { formatDate } from '../lib/format';

const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toUtc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

interface Week {
  start: number;
  days: { iso: string; count: number | null }[];
  monthLabel?: string;
}

/** A contribution-style calendar: one square per day, a column per week, a row per weekday. */
export const Calendar: React.FC<{ daily: DailyPoint[] }> = ({ daily }) => {
  const [ref, seen] = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<{ iso: string; count: number } | null>(null);

  const { weeks, max, years } = useMemo(() => {
    const counts = new Map(daily.map((d) => [d.date, d.count]));
    const first = toUtc(daily[0].date);
    const last = toUtc(daily[daily.length - 1].date);
    // Start on the Monday on or before the first day.
    const firstDow = (new Date(first).getUTCDay() + 6) % 7;
    const start = first - firstDow * DAY;
    const weeks: Week[] = [];
    let lastMonth = -1;
    for (let w = start; w <= last; w += 7 * DAY) {
      const days = Array.from({ length: 7 }, (_, i) => {
        const ms = w + i * DAY;
        const iso = toIso(ms);
        const inRange = ms >= first && ms <= last;
        return { iso, count: inRange ? counts.get(iso) ?? 0 : null };
      });
      const month = new Date(w).getUTCMonth();
      const week: Week = { start: w, days };
      if (month !== lastMonth) {
        week.monthLabel = MONTHS[month];
        lastMonth = month;
      }
      weeks.push(week);
    }
    const max = Math.max(...daily.map((d) => d.count), 1);
    const years = new Set(daily.map((d) => d.date.slice(0, 4))).size;
    return { weeks, max, years };
  }, [daily]);

  const cell = 'h-[9px] w-[9px] sm:h-[11px] sm:w-[11px]';

  return (
    <div ref={ref}>
      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div
          role="img"
          aria-label={`Calendar of messages per day across ${years} ${years === 1 ? 'year' : 'years'}.`}
          className="inline-flex flex-col gap-[3px]"
          onMouseLeave={() => setHover(null)}
        >
          <div className="flex gap-[3px] text-[10px] text-muted h-3 leading-3">
            {weeks.map((w) => (
              <div key={w.start} className={`${cell} relative`}>
                {w.monthLabel && <span className="absolute left-0 whitespace-nowrap">{w.monthLabel}</span>}
              </div>
            ))}
          </div>
          {Array.from({ length: 7 }, (_, dow) => (
            <div key={dow} className="flex gap-[3px]">
              {weeks.map((w, wi) => {
                const d = w.days[dow];
                if (d.count === null) return <div key={w.start} className={cell} />;
                const t = d.count / max;
                const alpha = d.count === 0 ? 0.06 : 0.15 + Math.pow(t, 0.55) * 0.85;
                return (
                  <div
                    key={w.start}
                    onMouseEnter={() => setHover({ iso: d.iso, count: d.count! })}
                    title={`${formatDate(d.iso)} · ${d.count.toLocaleString()} messages`}
                    className={`${cell}`}
                    style={{
                      backgroundColor: `rgb(var(--ink) / ${alpha})`,
                      opacity: seen ? 1 : 0,
                      transition: `opacity 400ms ease ${Math.min(wi * 8, 1200)}ms`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-4 text-sm text-muted">
        <p className="min-h-[1.5rem]" aria-live="polite">
          {hover ? (
            <>
              <span className="text-ink font-medium">{formatDate(hover.iso)}</span>:{' '}
              <span className="text-ink font-medium">{hover.count.toLocaleString()}</span> messages
            </>
          ) : (
            <>Each square is a day. Hover to see the count.</>
          )}
        </p>
        <div aria-hidden="true" className="flex items-center gap-1 text-xs shrink-0">
          Less
          {[0.06, 0.3, 0.55, 0.8, 1].map((a) => (
            <span key={a} className={cell} style={{ backgroundColor: `rgb(var(--ink) / ${a})` }} />
          ))}
          More
        </div>
      </div>
    </div>
  );
};
