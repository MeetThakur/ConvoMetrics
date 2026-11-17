import React from 'react';
import { OverviewData } from '../types';
import { StatGrid } from './StatGrid';
import { formatSpan } from '../lib/format';

export const MetricsOverview: React.FC<{ overview: OverviewData }> = ({ overview }) => (
  <StatGrid
    size="lg"
    cols={5}
    className="mb-12"
    stats={[
      { label: 'Messages', value: overview.total_messages },
      { label: 'Words', value: overview.total_words },
      { label: 'Emoji', value: overview.emojis_total },
      {
        label: 'Days with messages',
        value: overview.days_talked,
        detail: `of ${overview.span_days.toLocaleString()} (${formatSpan(overview.span_days)})`,
      },
      { label: 'People', value: overview.participants_count },
    ]}
  />
);
