import React from 'react';
import { Insights } from '../../types';
import { formatDuration } from '../../lib/format';
import { useNames } from '../../lib/names';
import { useInView } from '../../lib/motion';
import { Bars } from '../Bars';
import { StatGrid } from '../StatGrid';
import { Section, RankedList } from '../Section';

/** "within a minute" / "over 3 min": avoids the clumsy "over under a minute". */
const spanLabel = (minutes: number) => (minutes < 1 ? 'within a minute' : `over ${formatDuration(minutes)}`);

const ReplySpread: React.FC<{ dist: Insights['reply_distribution'] }> = ({ dist }) => {
  const { label, color } = useNames();
  const [ref, seen] = useInView<HTMLDivElement>();
  const rows = dist.per_sender.length > 1 ? dist.per_sender : [];
  return (
    <div ref={ref} className={seen ? 'is-in' : ''}>
      <div className="flex h-8 w-full" role="img" aria-label={`Reply times: ${dist.overall.map((b) => `${b.label} ${b.percentage}%`).join(', ')}`}>
        {dist.overall.map((b, i) => (
          <div
            key={b.label}
            title={`${b.label}: ${b.percentage}% (${b.count.toLocaleString()} replies)`}
            className="h-full border-r-2 border-paper last:border-r-0 grow-x"
            style={{
              width: `${b.percentage}%`,
              backgroundColor: `rgb(var(--ink) / ${1 - i * 0.15})`,
              transitionDelay: `${i * 70}ms`,
            }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {dist.overall.map((b, i) => (
          <li key={b.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5" style={{ backgroundColor: `rgb(var(--ink) / ${1 - i * 0.15})` }} />
            <span>{b.label}</span>
            <span className="text-muted">{b.percentage}%</span>
          </li>
        ))}
      </ul>
      {rows.length > 0 && (
        <ul className="mt-8 space-y-4">
          {rows.map((p) => (
            <li key={p.name} className="grid sm:grid-cols-[10rem_1fr] gap-x-6 gap-y-1 items-center text-sm">
              <div>
                <div className="font-medium truncate">{label(p.name)}</div>
                <div className="text-muted">{p.fastest_share}% within a minute</div>
              </div>
              <div className="flex h-4 w-full" aria-hidden="true">
                {p.buckets.map((b, i) => (
                  <div
                    key={b.label}
                    title={`${b.label}: ${b.percentage}%`}
                    className="h-full border-r border-paper last:border-r-0 grow-x"
                    style={{
                      width: `${b.percentage}%`,
                      backgroundColor: color(p.name),
                      opacity: 1 - i * 0.15,
                      transitionDelay: `${i * 70}ms`,
                    }}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const ConversationsTab: React.FC<{ insights: Insights; platform: string }> = ({ insights, platform }) => {
  const { label, color } = useNames();
  const { conversations: c, responsiveness: r, double_texting: dt, rallies: rallyData, rally_gap_minutes: gapMin } = insights;
  const rallies = rallyData.longest;
  const pingPong = rallyData.ping_pong;
  const best = rallies[0];

  return (
    <>
      {platform.includes('WhatsApp') && (
        <p className="-mt-2 mb-8 text-sm text-muted max-w-2xl">
          WhatsApp exports record time only to the minute, so reply times and rally lengths below can be off by up
          to a minute, and messages sent in the same minute count as 0 minutes apart.
        </p>
      )}

      <StatGrid
        cols={4}
        className="mb-12"
        stats={[
          { label: 'Conversations', value: c.total, detail: 'after an hour of quiet, a new one starts' },
          { label: 'Typical length', value: formatDuration(c.avg_minutes) },
          { label: 'Median reply', value: formatDuration(r.median_minutes), detail: 'across everyone' },
          { label: 'Longest silence', value: c.longest_silence.days, decimals: 1, unit: 'days', detail: c.longest_silence.ended ? `ended ${c.longest_silence.ended}` : undefined },
        ]}
      />

      <Section title="Reply speed" note="Time to answer the other person. Gaps over 6 hours don't count.">
        {r.per_sender.length === 0 ? (
          <p className="text-muted">Not enough back-and-forth to measure.</p>
        ) : (
          <Bars
            items={r.per_sender.map((p) => ({
              label: label(p.name),
              value: p.median_minutes,
              display: formatDuration(p.median_minutes),
              color: color(p.name),
              detail: `median · ${formatDuration(p.avg_minutes)} average · ${p.replies.toLocaleString()} replies`,
            }))}
          />
        )}
      </Section>

      {insights.reply_distribution.overall.some((b) => b.count > 0) && (
        <Section title="How fast, usually" note="Where reply times fall">
          <ReplySpread dist={insights.reply_distribution} />
        </Section>
      )}

      <Section title="Longest conversations" note="Most time with no hour-long break">
        <RankedList>
          {c.longest.map((s, i) => (
            <li key={i} className="grid grid-cols-[2rem_1fr_auto] gap-3 py-2 text-sm">
              <span className="text-muted">{i + 1}</span>
              <span>{s.date}</span>
              <span>
                {formatDuration(s.minutes)} <span className="text-muted">· {s.messages.toLocaleString()} messages</span>
              </span>
            </li>
          ))}
        </RankedList>
      </Section>

      <Section
        title="Longest rally"
        note={`Messages in a row with no break longer than ${gapMin} minutes between any two.`}
      >
        {!best ? (
          <p className="text-muted">
            No rallies yet. It takes 4 or more messages from at least two people, each within {gapMin} minutes of
            the last.
          </p>
        ) : (
          <>
            <p className="font-display text-2xl sm:text-3xl leading-snug max-w-3xl mb-8">
              {best.messages.toLocaleString()} messages without a {gapMin}-minute break
              <span className="text-muted">
                {' '}
                {spanLabel(best.minutes)}, between {best.people.map(label).join(', ')}, starting {best.time} on{' '}
                {best.date}.
              </span>
            </p>
            {rallies.length > 1 && (
              <>
                <h4 className="text-xs uppercase tracking-wider text-muted mb-3">Other long rallies</h4>
                <RankedList className="mb-8">
                  {rallies.slice(1).map((ra, i) => (
                    <li key={i} className="grid grid-cols-[2rem_1fr_auto] gap-3 py-2 text-sm">
                      <span className="text-muted">{i + 2}</span>
                      <span>
                        {ra.date} <span className="text-muted">· {ra.time}</span>
                      </span>
                      <span>
                        {ra.messages.toLocaleString()} messages{' '}
                        <span className="text-muted">· {spanLabel(ra.minutes)}</span>
                      </span>
                    </li>
                  ))}
                </RankedList>
              </>
            )}
            {pingPong && (
              <p className="text-sm text-muted max-w-2xl">
                <span className="text-ink font-medium">Longest ping-pong:</span> {pingPong.messages} messages where
                the sender changed every time, starting {pingPong.time} on {pingPong.date}.
              </p>
            )}
          </>
        )}
      </Section>

      <Section title="Double-texting" note="Longest run of messages from one person with no reply.">
        <Bars
          items={dt.map((d) => ({
            label: label(d.name),
            value: d.run,
            color: color(d.name),
            detail: `in a row · ${d.date}`,
          }))}
        />
      </Section>
    </>
  );
};
