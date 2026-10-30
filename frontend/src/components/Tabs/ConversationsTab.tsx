import React from 'react';
import { Insights } from '../../types';
import { formatDuration } from '../../lib/format';
import { useNames } from '../../lib/names';
import { Section } from '../Section';

/** "within a minute" / "over 3 min": avoids the clumsy "over under a minute". */
const spanLabel = (minutes: number) => (minutes < 1 ? 'within a minute' : `over ${formatDuration(minutes)}`);

export const ConversationsTab: React.FC<{ insights: Insights; platform: string }> = ({ insights, platform }) => {
  const { label } = useNames();
  const { conversations: c, responsiveness: r, double_texting: dt, rallies: rallyData, rally_gap_minutes: gapMin } = insights;
  const rallies = rallyData.longest;
  const pingPong = rallyData.ping_pong;
  const best = rallies[0];
  const nowrap = 'whitespace-nowrap';

  return (
    <>
      {platform.includes('WhatsApp') && (
        <p className="-mt-2 mb-8 text-sm text-muted max-w-2xl">
          WhatsApp exports record time only to the minute, so reply times and rally lengths below can be off by up
          to a minute, and messages sent in the same minute count as 0 minutes apart.
        </p>
      )}
      <Section title="Reply speed" note="Time to answer the other person's message. Gaps over 6 hours don't count.">
        {r.per_sender.length === 0 ? (
          <p className="text-muted">Not enough back-and-forth to measure.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted border-b border-rule">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 px-4 font-medium text-right">Median</th>
                  <th className="py-2 px-4 font-medium text-right">Average</th>
                  <th className="py-2 pl-4 font-medium text-right">Replies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {r.per_sender.map((p) => (
                  <tr key={p.name}>
                    <td className="py-3 pr-4 font-medium">{label(p.name)}</td>
                    <td className={`py-3 px-4 text-right ${nowrap}`}>{formatDuration(p.median_minutes)}</td>
                    <td className={`py-3 px-4 text-right ${nowrap}`}>{formatDuration(p.avg_minutes)}</td>
                    <td className="py-3 pl-4 text-right">{p.replies.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Length and gaps" note="A new conversation starts after an hour of quiet.">
        <dl className="grid grid-cols-3 border-y border-ink mb-8">
          {[
            ['Conversations', c.total.toLocaleString()],
            ['Average length', formatDuration(c.avg_minutes)],
            ['Longest silence', `${c.longest_silence.days} days`],
          ].map(([name, value], i) => (
            <div key={name} className={`py-4 px-4 first:pl-0 ${i > 0 ? 'border-l border-rule' : ''}`}>
              <dt className="text-xs uppercase tracking-wider text-muted mb-1">{name}</dt>
              <dd className="font-display text-2xl">{value}</dd>
            </div>
          ))}
        </dl>
        {c.longest_silence.ended && (
          <p className="text-sm text-muted mb-8">The longest silence ended on {c.longest_silence.ended}.</p>
        )}

        <h4 className="text-xs uppercase tracking-wider text-muted mb-3">Longest conversations</h4>
        <ol className="divide-y divide-rule border-y border-rule">
          {c.longest.map((s, i) => (
            <li key={i} className="grid grid-cols-[2rem_1fr_auto] gap-3 py-2 text-sm">
              <span className="text-muted">{i + 1}</span>
              <span>{s.date}</span>
              <span>
                {formatDuration(s.minutes)} <span className="text-muted">· {s.messages} messages</span>
              </span>
            </li>
          ))}
        </ol>
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
                <ol className="divide-y divide-rule border-y border-rule mb-8">
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
                </ol>
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
        <ul className="divide-y divide-rule border-y border-rule">
          {dt.map((d) => (
            <li key={d.name} className="grid grid-cols-[1fr_auto] gap-3 py-2 text-sm">
              <span className="font-medium">{label(d.name)}</span>
              <span>
                {d.run} in a row <span className="text-muted">· {d.date}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
};
