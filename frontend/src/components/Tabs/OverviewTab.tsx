import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Insights, ParticipantStat } from '../../types';
import { axisProps, gridProps, ChartTip } from '../../lib/theme';
import { useNames } from '../../lib/names';
import { Count, useInView } from '../../lib/motion';
import { ChartFrame, anim } from '../ChartFrame';
import { Section, thead, th } from '../Section';

interface OverviewTabProps {
  participants: ParticipantStat[];
  share: Insights['share_over_time'];
  openers: Insights['openers'];
  balance: number;
}

const balanceWord = (b: number) =>
  b >= 90 ? 'an even match' : b >= 75 ? 'fairly even' : b >= 50 ? 'one-sided at times' : 'mostly one person';

export const OverviewTab: React.FC<OverviewTabProps> = ({ participants, share, openers, balance }) => {
  const { label, color } = useNames();
  const [barRef, barSeen] = useInView<HTMLDivElement>();

  // Past six people the bar folds everyone after the top five into "Others".
  const segments =
    participants.length > 6
      ? [
          ...participants.slice(0, 5).map((p) => ({ name: p.name, percentage: p.percentage })),
          {
            name: 'Others',
            percentage: Math.round(participants.slice(5).reduce((a, p) => a + p.percentage, 0) * 10) / 10,
          },
        ]
      : participants.map((p) => ({ name: p.name, percentage: p.percentage }));

  // Keys are p0, p1, ... because names can contain characters recharts reads as paths.
  const data = share.periods.map((p) => ({
    label: p.label,
    ...Object.fromEntries(share.people.map((n, i) => [`p${i}`, p.counts[n]])),
  }));

  const two = participants.length === 2;

  return (
    <>
      <Section title="Who does the talking" note="Share of all messages">
        <div
          ref={barRef}
          className={`flex h-10 w-full ${barSeen ? 'is-in' : ''}`}
          role="img"
          aria-label={`Message share: ${segments.map((s) => `${label(s.name)} ${s.percentage}%`).join(', ')}`}
        >
          {segments.map((s, i) => (
            <div
              key={s.name}
              title={`${label(s.name)}: ${s.percentage}%`}
              style={{ width: `${s.percentage}%`, backgroundColor: color(s.name), transitionDelay: `${i * 80}ms` }}
              className="h-full border-r-2 border-paper last:border-r-0 grow-x flex items-center px-2 overflow-hidden"
            >
              {s.percentage >= 12 && (
                <span className="text-paper text-xs font-medium whitespace-nowrap">
                  {label(s.name)} {s.percentage}%
                </span>
              )}
            </div>
          ))}
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {segments.map((s) => (
            <li key={s.name} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5" style={{ backgroundColor: color(s.name) }} />
              <span>{label(s.name)}</span>
              <span className="text-muted">{s.percentage}%</span>
            </li>
          ))}
        </ul>

        {participants.length > 1 && (
          <div className="mt-8 grid sm:grid-cols-[auto_1fr] gap-x-8 gap-y-3 items-center">
            <div className="font-display text-5xl leading-none">
              <Count value={balance} />
              <span className="text-xl text-muted">/100</span>
            </div>
            <div>
              <div className="font-medium">Balance score: {balanceWord(balance)}</div>
              <p className="text-sm text-muted mt-0.5">
                100 means everyone sends the same number of messages; 0 means one person sends them all.
              </p>
            </div>
          </div>
        )}
      </Section>

      {share.periods.length > 1 && (
        <Section title="Share over time" note={`Each person's share of messages, by ${share.granularity}`}>
          <ChartFrame
            label="Share of messages over time"
            summary={`Stacked chart of ${share.people.map(label).join(', ')} across ${share.periods.length} ${share.granularity}s, from ${share.periods[0].label} to ${share.periods[share.periods.length - 1].label}.`}
            className="h-64 w-full"
          >
            <ResponsiveContainer>
              <AreaChart data={data} stackOffset="expand" margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid {...gridProps} vertical={false} />
                <XAxis dataKey="label" {...axisProps} minTickGap={40} />
                <YAxis
                  {...axisProps}
                  axisLine={false}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                />
                <Tooltip
                  content={(p) => (
                    <ChartTip
                      {...p}
                      render={(d) => (
                        <>
                          <div className="mb-1">{d.label}</div>
                          {share.people.map((n, i) => (
                            <div key={n}>
                              {label(n)}: <b>{d[`p${i}`].toLocaleString()}</b>
                            </div>
                          ))}
                        </>
                      )}
                    />
                  )}
                />
                {share.people.map((n, i) => (
                  <Area
                    key={n}
                    type="monotone"
                    dataKey={`p${i}`}
                    stackId="share"
                    stroke={color(n)}
                    fill={color(n)}
                    fillOpacity={0.85}
                    {...anim}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Section>
      )}

      {participants.length > 1 && (
        <Section
          title="Who opens, who closes"
          note={`Across ${openers.conversations.toLocaleString()} conversations and ${openers.days.toLocaleString()} days`}
        >
          <div className="grid gap-8 sm:grid-cols-3">
            {(
              [
                ['Starts the conversation', 'opened_share', 'opened'],
                ['Has the last word', 'closed_share', 'closed'],
                ['First message of the day', 'first_of_day_share', 'first_of_day'],
              ] as const
            ).map(([title, shareKey, countKey]) => {
              const rows = [...openers.per_sender].sort((a, b) => b[countKey] - a[countKey]).slice(0, 6);
              return (
                <div key={title}>
                  <h4 className="text-xs uppercase tracking-wider text-muted mb-3">{title}</h4>
                  <ul className="space-y-2.5">
                    {rows.map((p) => (
                      <li key={p.name} className="text-sm">
                        <div className="flex justify-between gap-3 mb-1">
                          <span className="truncate font-medium">{label(p.name)}</span>
                          <span className="text-muted whitespace-nowrap">
                            {p[shareKey]}% <span className="hidden sm:inline">· {p[countKey].toLocaleString()}</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-rule/60">
                          <div
                            className="h-full grow-x is-in"
                            style={{ width: `${p[shareKey]}%`, backgroundColor: color(p.name) }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          {two && (
            <p className="mt-6 text-sm text-muted max-w-2xl">
              A conversation starts after an hour of quiet. Whoever sends the first message opened it; whoever
              sends the last one closed it.
            </p>
          )}
        </Section>
      )}

      <Section title="By person">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className={thead}>
                <th className={`${th} pr-4`}>Name</th>
                <th className={`${th} px-4 text-right`}>Messages</th>
                <th className={`${th} px-4 text-right`}>Share</th>
                <th className={`${th} px-4 text-right`}>Words</th>
                <th className={`${th} px-4 text-right`}>Words / msg</th>
                <th className={`${th} pl-4 text-right`}>Emoji</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {participants.map((p) => (
                <tr key={p.name} className="transition-colors hover:bg-ink/[0.03]">
                  <td className="py-3 pr-4 font-medium">
                    <span className="inline-block w-2.5 h-2.5 mr-2" style={{ backgroundColor: color(p.name) }} />
                    {label(p.name)}
                  </td>
                  <td className="py-3 px-4 text-right">{p.messages.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-muted">{p.percentage}%</td>
                  <td className="py-3 px-4 text-right">{p.words.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">{p.avg_words}</td>
                  <td className="py-3 pl-4 text-right">{p.emojis ? p.emojis.toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
};
