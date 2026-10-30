import React from 'react';
import { WrappedData } from '../types';
import { useNames } from '../lib/names';
import { Section } from './Section';

export const ChatWrapped: React.FC<{ wrapped: WrappedData }> = ({ wrapped }) => {
  const { label, scrub } = useNames();
  const facts: [string, string, string][] = [
    [
      'Longest streak',
      `${wrapped.max_streak} ${wrapped.max_streak === 1 ? 'day' : 'days'}`,
      wrapped.streak_start && wrapped.streak_end
        ? `${wrapped.streak_start} to ${wrapped.streak_end}`
        : '',
    ],
    ['Peak hour', wrapped.peak_hour ?? '—', 'Most messages are sent in this hour'],
    [
      'Length in print',
      wrapped.book_pages < 1 ? 'Under a page' : `${wrapped.book_pages.toLocaleString()} pages`,
      `${wrapped.total_words.toLocaleString()} words, at about 250 per page`,
    ],
  ];

  return (
    <Section title="Highlights">
      <p className="font-display text-2xl sm:text-3xl leading-snug max-w-3xl mb-10">
        It started on {wrapped.first_date}, when {label(wrapped.first_sender)} wrote{' '}
        <span className="text-accent">“{scrub(wrapped.first_msg)}”</span>
      </p>

      <dl className="divide-y divide-rule border-y border-rule">
        {facts.map(([label, value, detail]) => (
          <div key={label} className="grid sm:grid-cols-[11rem_1fr_1fr] gap-x-6 gap-y-0.5 py-3">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="font-medium">{value}</dd>
            <dd className="text-sm text-muted">{detail}</dd>
          </div>
        ))}
      </dl>

      {wrapped.awards && wrapped.awards.length > 0 && (
        <div className="mt-10">
          <h4 className="text-xs uppercase tracking-wider text-muted mb-3">Superlatives</h4>
          <dl className="divide-y divide-rule border-y border-rule">
            {wrapped.awards.map((a) => (
              <div key={a.title} className="grid sm:grid-cols-[11rem_1fr_1fr] gap-x-6 gap-y-0.5 py-3">
                <dt className="text-sm text-muted">{a.title}</dt>
                <dd className="font-medium">{label(a.recipient)}</dd>
                <dd className="text-sm text-muted">{a.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Section>
  );
};
