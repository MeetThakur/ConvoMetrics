import React from 'react';
import { Insights } from '../../types';
import { useNames } from '../../lib/names';
import { Bars } from '../Bars';
import { Section } from '../Section';

type Metric = 'questions' | 'exclamations' | 'night';

const METRICS: { key: Metric; title: string; note: string }[] = [
  { key: 'questions', title: 'Questions', note: 'Messages with a ?' },
  { key: 'exclamations', title: 'Exclamations', note: 'Messages with a !' },
  { key: 'night', title: 'Late nights', note: 'Messages between midnight and 5 AM' },
];

export const StyleTab: React.FC<{ style: Insights['style'] }> = ({ style }) => {
  const { label, color } = useNames();
  return (
    <div className="grid md:grid-cols-2 gap-x-10">
      {METRICS.map((m) => {
        const items = style
          .map((p) => ({
            label: label(p.name),
            value: p[m.key],
            color: color(p.name),
            detail: `(${((p[m.key] / Math.max(p.messages, 1)) * 100).toFixed(0)}%)`,
          }))
          .sort((a, b) => b.value - a.value);
        return (
          <Section key={m.key} title={m.title} note={m.note}>
            <Bars items={items} />
          </Section>
        );
      })}
      <p className="md:col-span-2 text-sm text-muted -mt-6">
        Percentages are the share of that person's own messages.
      </p>
    </div>
  );
};
