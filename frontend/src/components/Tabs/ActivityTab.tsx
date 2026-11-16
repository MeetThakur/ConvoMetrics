import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Insights, TimelineData } from '../../types';
import { ACCENT, INK, MUTED, CURSOR_FILL, axisProps, gridProps, ChartTip } from '../../lib/theme';
import { useNames } from '../../lib/names';
import { useInView } from '../../lib/motion';
import { formatDate, hourLabel } from '../../lib/format';
import { Bars } from '../Bars';
import { Calendar } from '../Calendar';
import { ChartFrame, anim } from '../ChartFrame';
import { Heatmap } from '../Heatmap';
import { StatGrid } from '../StatGrid';
import { Section, RankedList } from '../Section';

const margin = { top: 8, right: 8, left: -16, bottom: 0 };
const isWeekend = (d: string) => d === 'Saturday' || d === 'Sunday';
const isNight = (h: string) => parseInt(h, 10) < 5;

const peak = <T,>(rows: T[], value: (r: T) => number) =>
  rows.reduce((best, r) => (value(r) > value(best) ? r : best), rows[0]);

const PersonHours: React.FC<{ rows: Insights['texting_hours'] }> = ({ rows }) => {
  const { label, color } = useNames();
  const [ref, seen] = useInView<HTMLUListElement>();
  return (
    <ul ref={ref} className={`space-y-6 ${seen ? 'is-in' : ''}`}>
      {rows.map((p) => {
        const max = Math.max(...p.hourly, 1);
        const peakAt = hourLabel(p.peak_hour);
        return (
          <li key={p.name} className="grid sm:grid-cols-[10rem_1fr] gap-x-6 gap-y-2">
            <div>
              <div className="font-medium truncate">{label(p.name)}</div>
              <div className="text-sm text-muted">
                Busiest at {peakAt} ({p.peak_period})
              </div>
            </div>
            <div>
              <div
                role="img"
                aria-label={`${label(p.name)} writes most around ${peakAt} (${p.peak_period}).`}
                className="flex items-end gap-px h-12"
              >
                {p.hourly.map((v, h) => (
                  <div
                    key={h}
                    title={`${hourLabel(h)} · ${v.toLocaleString()} messages`}
                    className="flex-1 grow-y"
                    style={{
                      height: `${Math.max((v / max) * 100, v > 0 ? 4 : 0)}%`,
                      backgroundColor: color(p.name),
                      opacity: h === p.peak_hour ? 1 : 0.55,
                      transitionDelay: `${h * 20}ms`,
                    }}
                  />
                ))}
              </div>
              <div aria-hidden="true" className="mt-1 flex justify-between text-xs text-muted">
                <span>00</span>
                <span>06</span>
                <span>12</span>
                <span>18</span>
                <span>23</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export const ActivityTab: React.FC<{ timeline: TimelineData; insights: Insights }> = ({
  timeline,
  insights,
}) => {
  const { label, color } = useNames();
  const timeOfDay = insights.time_of_day;
  const { busiest_days: busiest, milestones, yearly, streaks } = insights;

  const topDay = peak(timeline.day_of_week, (d) => d.count);
  const topHour = peak(timeline.hourly, (h) => h.count);
  const topMonth = peak(timeOfDay.monthly, (m) => m.count);
  const topDaily = peak(timeline.daily, (d) => d.count);
  const yearMax = Math.max(...yearly.map((y) => y.count), 1);

  return (
    <>
      <StatGrid
        cols={4}
        className="mb-12"
        stats={[
          { label: 'Days active', value: timeOfDay.active_percentage, decimals: 1, suffix: '%', detail: `${timeOfDay.active_days.toLocaleString()} of ${timeOfDay.span_days.toLocaleString()} days` },
          { label: 'Per active day', value: timeOfDay.messages_per_active_day, decimals: 1, unit: 'messages' },
          { label: 'Weekend share', value: insights.heatmap.weekend_share, decimals: 1, suffix: '%', detail: 'of all messages' },
          { label: 'Week-long streaks', value: streaks.count_over_week, detail: '7+ days in a row' },
        ]}
      />

      <Section title="Over time" note="Messages per day">
        <ChartFrame
          label="Messages per day"
          summary={`${timeline.daily.length} days with messages. The busiest day was ${topDaily.date} with ${topDaily.count} messages.`}
          className="h-72 w-full"
        >
          <ResponsiveContainer>
            <AreaChart data={timeline.daily} margin={margin}>
              <defs>
                <linearGradient id="dailyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="date" {...axisProps} minTickGap={50} tickFormatter={(d: string) => formatDate(d)} />
              <YAxis {...axisProps} axisLine={false} />
              <Tooltip
                cursor={{ stroke: ACCENT }}
                content={(p) => (
                  <ChartTip
                    {...p}
                    render={(d) => (
                      <>
                        {formatDate(d.date)}: <b>{d.count.toLocaleString()}</b>
                      </>
                    )}
                  />
                )}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={ACCENT}
                strokeWidth={1.5}
                fill="url(#dailyFill)"
                {...anim}
                animationDuration={1400}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>
      </Section>

      <Section title="Every day" note="One square per day, darker is busier">
        <Calendar daily={timeline.daily} />
      </Section>

      <Section title="Weekday × hour" note="Where the chat lives">
        <Heatmap data={insights.heatmap} />
      </Section>

      <div className="grid lg:grid-cols-2 gap-x-10">
        <Section title="By weekday" note="Weekends in red">
          <ChartFrame
            label="Messages by weekday"
            summary={`${topDay.day} is the busiest weekday with ${topDay.count.toLocaleString()} messages.`}
            table={{ headers: ['Day', 'Messages'], rows: timeline.day_of_week.map((d) => [d.day, d.count]) }}
            className="h-60 w-full"
          >
            <ResponsiveContainer>
              <BarChart data={timeline.day_of_week} margin={margin}>
                <CartesianGrid {...gridProps} vertical={false} />
                <XAxis dataKey="day" {...axisProps} tickFormatter={(d: string) => d.slice(0, 3)} />
                <YAxis {...axisProps} axisLine={false} />
                <Tooltip
                  cursor={{ fill: CURSOR_FILL }}
                  content={(p) => (
                    <ChartTip
                      {...p}
                      render={(d) => (
                        <>
                          {d.day}: <b>{d.count.toLocaleString()}</b>
                        </>
                      )}
                    />
                  )}
                />
                <Bar dataKey="count" {...anim}>
                  {timeline.day_of_week.map((d) => (
                    <Cell key={d.day} fill={isWeekend(d.day) ? ACCENT : INK} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Section>

        <Section title="By hour" note="Midnight to 5 AM in grey">
          <ChartFrame
            label="Messages by hour of day"
            summary={`${topHour.hour} is the busiest hour with ${topHour.count.toLocaleString()} messages.`}
            table={{ headers: ['Hour', 'Messages'], rows: timeline.hourly.map((h) => [h.hour, h.count]) }}
            className="h-60 w-full"
          >
            <ResponsiveContainer>
              <BarChart data={timeline.hourly} margin={margin}>
                <CartesianGrid {...gridProps} vertical={false} />
                <XAxis dataKey="hour" {...axisProps} interval={2} />
                <YAxis {...axisProps} axisLine={false} />
                <Tooltip
                  cursor={{ fill: CURSOR_FILL }}
                  content={(p) => (
                    <ChartTip
                      {...p}
                      render={(d) => (
                        <>
                          {d.hour}: <b>{d.count.toLocaleString()}</b>
                        </>
                      )}
                    />
                  )}
                />
                <Bar dataKey="count" {...anim}>
                  {timeline.hourly.map((h) => (
                    <Cell key={h.hour} fill={isNight(h.hour) ? MUTED : INK} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Section>
      </div>

      <div className="grid lg:grid-cols-2 gap-x-10">
        <Section title="Time of day" note="Share of all messages">
          <Bars
            items={timeOfDay.buckets.map((b) => ({
              label: b.label,
              value: b.percentage,
              detail: `(${b.count.toLocaleString()})`,
            }))}
            suffix="%"
          />
        </Section>

        <Section title="By month" note="Across all years combined">
          <ChartFrame
            label="Messages by calendar month"
            summary={`${topMonth.month} is the busiest month with ${topMonth.count.toLocaleString()} messages.`}
            table={{ headers: ['Month', 'Messages'], rows: timeOfDay.monthly.map((m) => [m.month, m.count]) }}
            className="h-52 w-full"
          >
            <ResponsiveContainer>
              <BarChart data={timeOfDay.monthly} margin={margin}>
                <CartesianGrid {...gridProps} vertical={false} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} axisLine={false} />
                <Tooltip
                  cursor={{ fill: CURSOR_FILL }}
                  content={(p) => (
                    <ChartTip
                      {...p}
                      render={(d) => (
                        <>
                          {d.month}: <b>{d.count.toLocaleString()}</b>
                        </>
                      )}
                    />
                  )}
                />
                <Bar dataKey="count" fill={INK} {...anim} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Section>
      </div>

      {yearly.length > 1 && (
        <Section title="Year by year">
          <RankedList ordered={false}>
            {yearly.map((y) => (
              <li key={y.year} className="grid grid-cols-[4rem_1fr_auto] items-center gap-4 py-3 text-sm">
                <span className="font-display text-xl">{y.year}</span>
                <span className="h-2.5 bg-rule/60">
                  <span className="block h-full bg-ink grow-x is-in" style={{ width: `${(y.count / yearMax) * 100}%` }} />
                </span>
                <span className="text-right whitespace-nowrap">
                  <span className="font-medium">{y.count.toLocaleString()}</span>
                  <span className="text-muted">
                    {' '}
                    · {y.days} days · mostly {label(y.top_sender)} ({y.top_share}%)
                  </span>
                </span>
              </li>
            ))}
          </RankedList>
        </Section>
      )}

      <Section title="When each person writes" note="Each strip shows that person's own pattern across the 24 hours.">
        <PersonHours rows={insights.texting_hours} />
      </Section>

      <div className="grid lg:grid-cols-2 gap-x-10">
        <Section title="Busiest days" note="Most messages in one day">
          <RankedList>
            {busiest.map((d, i) => (
              <li key={d.date} className="grid grid-cols-[2rem_1fr_auto] gap-3 py-2 text-sm">
                <span className="text-muted">{i + 1}</span>
                <span>
                  {d.date}{' '}
                  <span className="text-muted">
                    · {d.top_sender ? `most from ${label(d.top_sender)}` : 'evenly split'}
                  </span>
                </span>
                <span className="font-medium">{d.count.toLocaleString()}</span>
              </li>
            ))}
          </RankedList>
        </Section>

        <Section title="Streaks and milestones">
          <dl className="divide-y divide-rule border-y border-rule text-sm">
            {streaks.top.slice(0, 3).map((s, i) => (
              <div key={s.start} className="grid grid-cols-[8rem_1fr] gap-3 py-2">
                <dt className="text-muted">{i === 0 ? 'Longest streak' : `Streak ${i + 1}`}</dt>
                <dd>
                  {s.days} days <span className="text-muted">· {s.start} to {s.end}</span>
                </dd>
              </div>
            ))}
            {milestones.messages.map((m) => (
              <div key={m.number} className="grid grid-cols-[8rem_1fr] gap-3 py-2">
                <dt className="text-muted">Message {m.number.toLocaleString()}</dt>
                <dd>
                  {m.date}{' '}
                  <span className="text-muted">
                    · <span className="inline-block w-2 h-2 mr-1" style={{ backgroundColor: color(m.sender) }} />
                    {label(m.sender)}
                  </span>
                </dd>
              </div>
            ))}
            <div className="grid grid-cols-[8rem_1fr] gap-3 py-2">
              <dt className="text-muted">Busiest month</dt>
              <dd>
                {milestones.busiest_month.label}{' '}
                <span className="text-muted">· {milestones.busiest_month.count.toLocaleString()} messages</span>
              </dd>
            </div>
            {milestones.busiest_year && (
              <div className="grid grid-cols-[8rem_1fr] gap-3 py-2">
                <dt className="text-muted">Busiest year</dt>
                <dd>
                  {milestones.busiest_year.label}{' '}
                  <span className="text-muted">· {milestones.busiest_year.count.toLocaleString()} messages</span>
                </dd>
              </div>
            )}
          </dl>
        </Section>
      </div>
    </>
  );
};
