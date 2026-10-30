import React from 'react';

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

/** Wraps a chart so screen readers get a description and data instead of unlabeled SVG. */
export const ChartFrame: React.FC<ChartFrameProps> = ({ label, summary, table, className, children }) => (
  <div role="group" aria-label={label} className={className}>
    {summary && <p className="sr-only">{summary}</p>}
    <div aria-hidden="true" className="h-full w-full">
      {children}
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
