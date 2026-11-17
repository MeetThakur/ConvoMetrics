import React from 'react';
import { useInView } from '../lib/motion';

interface ChartFrameProps {
  /** What the chart is, e.g. "Messages by weekday". */
  label: string;
  /** One or two sentences with the takeaway, read instead of the picture. */
  summary?: string;
  /** Underlying numbers for screen readers (kept short: skip for long series). */
  table?: { headers: string[]; rows: (string | number)[][] };
  className?: string;
  children: React.ReactNode;
}

/**
 * Wraps a chart so screen readers get a description and data instead of unlabeled SVG.
 * The chart itself mounts only once it scrolls into view, so its draw-in animation is seen.
 */
export const ChartFrame: React.FC<ChartFrameProps> = ({ label, summary, table, className, children }) => {
  const [ref, seen] = useInView<HTMLDivElement>('0px 0px -5% 0px');
  return (
    <div ref={ref} role="group" aria-label={label} className={className}>
      {summary && <p className="sr-only">{summary}</p>}
      <div aria-hidden="true" className="h-full w-full">
        {seen ? children : null}
      </div>
      {table && (
        <table className="sr-only">
          <caption>{label}</caption>
          <thead>
            <tr>
              {table.headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

/** Shared animation settings for recharts series. */
export const anim = { isAnimationActive: true, animationDuration: 900, animationEasing: 'ease-out' as const };
