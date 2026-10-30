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
import { Bars } from '../Bars';
import { ChartFrame } from '../ChartFrame';
import { Section } from '../Section';

const margin = { top: 8, right: 8, left: -16, bottom: 0 };
const isWeekend = (d: string) => d === 'Saturday' || d === 'Sunday';
const isNight = (h: string) => parseInt(h, 10) < 5;

const peak = <T,>(rows: T[], value: (r: T) => number) =>
  rows.reduce((best, r) => (value(r) > value(best) ? r : best), rows[0]);

export const ActivityTab: React.FC<{ timeline: TimelineData; insights: Insights }> = ({
  timeline,
  insights,
}) => {
  const { label, color } = useNames();
  const timeOfDay = insights.time_of_day;
  const { busiest_days: busiest, milestones } = insights;

  const topDay = peak(timeline.day_of_week, (d) => d.count);
  const topHour = peak(timeline.hourly, (h) => h.count);
  const topMonth = peak(timeOfDay.monthly, (m) => m.count);
  const topDaily = peak(timeline.daily, (d) => d.count);

  return (
    <>
      <dl className="grid grid-cols-2 border-y border-ink mb-12">
        {[
          ['Days active', `${timeOfDay.active_percentage}%`, `${timeOfDay.active_days} of ${timeOfDay.span_days} days`],
          ['Per active day', timeOfDay.messages_per_active_day.toLocaleString(), 'messages'],
        ].map(([name, value, unit], i) => (
          <div key={name} className={`py-4 px-4 first:pl-0 ${i > 0 ? 'border-l border-rule' : ''}`}>
            <dt className="text-xs uppercase tracking-wider text-muted mb-1">{name}</dt>
            <dd className="font-display text-2xl">
              {value} <span className="font-sans text-sm text-muted">{unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      <Section title="Over time" note="Messages per day">
        <ChartFrame
          label="Messages per day"
          summary={`${timeline.daily.length} days with messages. The busiest day was ${topDaily.date} with ${topDaily.count} messages.`}
          className="h-72 w-full"
        >
          <ResponsiveContainer>
            <AreaChart data={timeline.daily} margin={margin}>
              <CartesianGrid {...gridProps} vertical={false} />
              <XAxis dataKey="date" {...axisProps} minTickGap={50} />
              <YAxis {...axisProps} axisLine={false} />
              <Tooltip
                cursor={{ stroke: INK }}
                content={(p) => (
                  <ChartTip
                    {...p}
                    render={(d) => (
                      <>
                        {d.date}: <b>{d.count.toLocaleString()}</b>
                      </>
                    )}
                  />
                )}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={INK}
                strokeWidth={1.5}
                fill={INK}
                fillOpacity={0.08}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>
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
                <Bar dataKey="count" isAnimationActive={false}>
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
                <Bar dataKey="count" isAnimationActive={false}>
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
                <Bar dataKey="count" fill={INK} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Section>
      </div>

      <Section title="When each person writes" note="Each strip shows that person's own pattern across the 24 hours.">
        <ul className="space-y-6">
          {insights.texting_hours.map((p) => {
            const max = Math.max(...p.hourly, 1);
            const peak = `${String(p.peak_hour).padStart(2, '0')}:00`;
            return (
              <li key={p.name} className="grid sm:grid-cols-[10rem_1fr] gap-x-6 gap-y-2">
                <div>
                  <div className="font-medium truncate">{label(p.name)}</div>
                  <div className="text-sm text-muted">
                    Busiest at {peak} ({p.peak_period})
                  </div>
                </div>
                <div>
                  <div
                    role="img"
                    aria-label={`${label(p.name)} writes most around ${peak} (${p.peak_period}).`}
                    className="flex items-end gap-px h-12"
                  >
                    {p.hourly.map((v, h) => (
                      <div
                        key={h}
                        title={`${String(h).padStart(2, '0')}:00 · ${v.toLocaleString()} messages`}
                        className="flex-1"
                        style={{
                          height: `${Math.max((v / max) * 100, v > 0 ? 4 : 0)}%`,
                          backgroundColor: color(p.name),
                          opacity: h === p.peak_hour ? 1 : 0.55,
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
      </Section>

      <div className="grid lg:grid-cols-2 gap-x-10">
        <Section title="Busiest days" note="Most messages in one day">
          <ol className="divide-y divide-rule border-y border-rule">
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
          </ol>
        </Section>

        <Section title="Milestones">
          <dl className="divide-y divide-rule border-y border-rule text-sm">
            {milestones.messages.map((m) => (
              <div key={m.number} className="grid grid-cols-[8rem_1fr] gap-3 py-2">
                <dt className="text-muted">Message {m.number.toLocaleString()}</dt>
                <dd>
                  {m.date} <span className="text-muted">· sent by {label(m.sender)}</span>
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
