import React from 'react';
import { Insights, WrappedData } from '../types';
import { useNames } from '../lib/names';
import { Count, Reveal } from '../lib/motion';
import { Section } from './Section';

interface Props {
  wrapped: WrappedData;
  insights: Insights;
}

interface Fact {
  label: string;
  value: React.ReactNode;
  detail: string;
}

export const ChatWrapped: React.FC<Props> = ({ wrapped, insights }) => {
  const { label, scrub, color } = useNames();
  const streaks = insights.streaks;
  const big = 'font-display text-4xl sm:text-5xl leading-none tracking-tight';

  const facts: Fact[] = [
    {
      label: 'Longest streak',
      value: (
        <>
          <Count value={wrapped.max_streak} /> <span className="text-2xl text-muted">days</span>
        </>
      ),
      detail:
        wrapped.streak_start && wrapped.streak_end
          ? `${wrapped.streak_start} to ${wrapped.streak_end}${
              streaks.count_over_week > 1 ? `. One of ${streaks.count_over_week} streaks over a week.` : ''
            }`
          : '',
    },
    {
      label: 'Busiest day',
      value: (
        <>
          <Count value={wrapped.busiest_count ?? 0} /> <span className="text-2xl text-muted">messages</span>
        </>
      ),
      detail: wrapped.busiest_date ? `In one day, on ${wrapped.busiest_date}.` : '',
    },
    {
      label: 'Peak hour',
      value: wrapped.peak_hour ?? '—',
      detail: `Most messages land in this hour, and ${insights.heatmap.peak.day}s most of all.`,
    },
    {
      label: 'Length in print',
      value: (
        <>
          <Count value={wrapped.book_pages} /> <span className="text-2xl text-muted">pages</span>
        </>
      ),
      detail: `${wrapped.total_words.toLocaleString()} words, at about 250 per page.`,
    },
    {
      label: 'Longest silence',
      value: (
        <>
          <Count value={insights.conversations.longest_silence.days} decimals={1} />{' '}
          <span className="text-2xl text-muted">days</span>
        </>
      ),
      detail: insights.conversations.longest_silence.ended
        ? `Ended on ${insights.conversations.longest_silence.ended}.`
        : '',
    },
    {
      label: 'Conversations',
      value: <Count value={insights.conversations.total} />,
      detail: `Counting a new one after an hour of quiet.`,
    },
  ];

  return (
    <Section title="Highlights">
      <p className="font-display text-2xl sm:text-4xl leading-snug max-w-3xl mb-12">
        It started on {wrapped.first_date}, when {label(wrapped.first_sender)} wrote{' '}
        <span className="text-accent">“{scrub(wrapped.first_msg)}”</span>
      </p>

      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-rule">
        {facts.map((f, i) => (
          <Reveal as="li" key={f.label} delay={i} className="border-r border-b border-rule p-5 min-h-[9.5rem] flex flex-col">
            <div className="text-xs uppercase tracking-wider text-muted">{f.label}</div>
            <div className={`${big} mt-3`}>{f.value}</div>
            <div className="text-sm text-muted mt-auto pt-3">{f.detail}</div>
          </Reveal>
        ))}
      </ul>

      {wrapped.awards && wrapped.awards.length > 0 && (
        <div className="mt-12">
          <h4 className="text-xs uppercase tracking-wider text-muted mb-3">Superlatives</h4>
          <ol className="grid md:grid-cols-2 gap-x-12 border-t border-ink">
            {wrapped.awards.map((a, i) => (
              <Reveal
                as="li"
                key={a.title}
                delay={i}
                className="grid grid-cols-[2.5rem_1fr] gap-x-3 py-4 border-b border-rule items-baseline"
              >
                <span className="font-display text-sm text-muted tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                    <span className="font-display text-xl leading-tight">{a.title}</span>
                    <span className="font-medium flex items-center gap-2 truncate">
                      <span className="inline-block w-2 h-2 shrink-0" style={{ backgroundColor: color(a.recipient) }} />
                      {label(a.recipient)}
                    </span>
                  </div>
                  <div className="text-sm text-muted mt-1">{a.description}</div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      )}
    </Section>
  );
};
