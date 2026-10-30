import React from 'react';
import { OverviewData } from '../types';

export const MetricsOverview: React.FC<{ overview: OverviewData }> = ({ overview }) => {
  const metrics = [
    ['Messages', overview.total_messages],
    ['Words', overview.total_words],
    ['Characters', overview.total_chars],
    ['Days with messages', overview.days_talked],
    ['People', overview.participants_count],
  ];

  return (
    <dl className="grid grid-cols-2 sm:grid-cols-5 border-y border-ink mb-12">
      {metrics.map(([label, value], i) => (
        <div
          key={label}
          className={`py-5 px-4 first:pl-0 ${i > 0 ? 'sm:border-l border-rule' : ''}`}
        >
          <dt className="text-xs uppercase tracking-wider text-muted mb-1">{label}</dt>
          <dd className="font-display text-3xl">{(value as number).toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  );
};
