import React, { useState } from 'react';
import { Insights } from '../types';
import { useInView } from '../lib/motion';
import { hourLabel } from '../lib/format';

/** Weekday x hour grid. Darker cells are busier; the single busiest cell is in the accent colour. */
export const Heatmap: React.FC<{ data: Insights['heatmap'] }> = ({ data }) => {
  const [ref, seen] = useInView<HTMLDivElement>();
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(data.peak.count, 1);
  const hovered = hover ? data.rows[hover.d][hover.h] : null;

  return (
    <div ref={ref}>
      <div
        role="img"
        aria-label={`Messages by weekday and hour. Busiest: ${data.peak.day} at ${hourLabel(data.peak.hour)} with ${data.peak.count.toLocaleString()} messages.`}
        className="grid gap-x-2 text-xs text-muted"
        style={{ gridTemplateColumns: '2.5rem 1fr' }}
        onMouseLeave={() => setHover(null)}
      >
        {data.days.map((day, d) => (
          <React.Fragment key={day}>
            <div className="flex items-center h-5 sm:h-6">{day.slice(0, 3)}</div>
            <div className="grid gap-px h-5 sm:h-6" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
              {data.rows[d].map((v, h) => {
                const isPeak = day === data.peak.day && h === data.peak.hour;
                const t = v / max;
                const alpha = v === 0 ? 0.06 : 0.12 + Math.pow(t, 0.6) * 0.88;
                return (
                  <div
                    key={h}
                    onMouseEnter={() => setHover({ d, h })}
                    title={`${day} ${hourLabel(h)} · ${v.toLocaleString()} messages`}
                    className="h-full"
                    style={{
                      backgroundColor: isPeak ? 'rgb(var(--accent))' : `rgb(var(--ink) / ${alpha})`,
                      opacity: seen ? 1 : 0,
                      transition: `opacity 500ms ease ${(d * 24 + h) * 4}ms`,
                      outline: hover && hover.d === d && hover.h === h ? '1px solid rgb(var(--ink))' : 'none',
                    }}
                  />
                );
              })}
            </div>
          </React.Fragment>
        ))}
        <div />
        <div aria-hidden="true" className="grid mt-1" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className={h % 6 === 0 ? '' : 'invisible'}>
              {String(h).padStart(2, '0')}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-3 text-sm text-muted min-h-[1.5rem]" aria-live="polite">
        {hover && hovered !== null ? (
          <>
            <span className="text-ink font-medium">{data.days[hover.d]}</span> at {hourLabel(hover.h)}:{' '}
            <span className="text-ink font-medium">{hovered.toLocaleString()}</span> messages
          </>
        ) : (
          <>
            Busiest cell: <span className="text-ink font-medium">{data.peak.day}</span> at{' '}
            {hourLabel(data.peak.hour)}, {data.peak.count.toLocaleString()} messages. Weekends carry{' '}
            {data.weekend_share}% of the chat.
          </>
        )}
      </p>
    </div>
  );
};
