import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Insights, ParticipantStat } from '../../types';
import { axisProps, gridProps, ChartTip } from '../../lib/theme';
import { useNames } from '../../lib/names';
import { ChartFrame } from '../ChartFrame';
import { Section } from '../Section';

interface OverviewTabProps {
  participants: ParticipantStat[];
  share: Insights['share_over_time'];
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ participants, share }) => {
  const { label, color } = useNames();

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

  return (
    <>
      <Section title="Who does the talking" note="Share of all messages">
        <div
          className="flex h-8 w-full"
          role="img"
          aria-label={`Message share: ${segments.map((s) => `${label(s.name)} ${s.percentage}%`).join(', ')}`}
        >
          {segments.map((s) => (
            <div
              key={s.name}
              title={`${label(s.name)}: ${s.percentage}%`}
              style={{ width: `${s.percentage}%`, backgroundColor: color(s.name) }}
              className="h-full border-r-2 border-paper last:border-r-0"
            />
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
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Section>
      )}

      <Section title="By person">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted border-b border-rule">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 px-4 font-medium text-right">Messages</th>
                <th className="py-2 px-4 font-medium text-right">Words</th>
                <th className="py-2 px-4 font-medium text-right">Words / msg</th>
                <th className="py-2 pl-4 font-medium text-right">Emojis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {participants.map((p) => (
                <tr key={p.name}>
                  <td className="py-3 pr-4 font-medium">
                    <span className="inline-block w-2.5 h-2.5 mr-2" style={{ backgroundColor: color(p.name) }} />
                    {label(p.name)}
                  </td>
                  <td className="py-3 px-4 text-right">{p.messages.toLocaleString()}</td>
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
