import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { WordIndex } from '../../types';
import { INK, CURSOR_FILL, axisProps, gridProps, ChartTip } from '../../lib/theme';
import { searchIndex } from '../../lib/search';
import { useNames } from '../../lib/names';
import { ChartFrame } from '../ChartFrame';
import { Section } from '../Section';

interface WordSearcherTabProps {
  index: WordIndex;
  initialQuery?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2024-03" -> "Mar 2024"; day labels pass through. */
const periodLabel = (p: string) => (/^\d{4}-\d{2}$/.test(p) ? `${MONTHS[+p.slice(5) - 1]} ${p.slice(0, 4)}` : p);

export const WordSearcherTab: React.FC<WordSearcherTabProps> = ({ index, initialQuery }) => {
  const { label, color, isNameWord } = useNames();
  const [term, setTerm] = useState(initialQuery || '');
  const [submitted, setSubmitted] = useState(initialQuery || '');

  useEffect(() => {
    if (initialQuery) {
      setTerm(initialQuery);
      setSubmitted(initialQuery);
    }
  }, [initialQuery]);

  // The index lives in the browser, so searching is instant and nothing is re-uploaded.
  const outcome = useMemo(() => (submitted ? searchIndex(index, submitted) : null), [index, submitted]);
  const result = outcome?.kind === 'result' ? outcome.result : null;
  const top = result?.by_sender[0];
  const blocked = result ? isNameWord(result.term) : false;

  return (
    <>
      <Section title="Who says it?" note="Type a word to see who uses it, and when.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(term);
          }}
          className="flex max-w-xl border-b border-ink"
        >
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="coffee"
            aria-label="Word to search for"
            className="flex-1 bg-transparent py-2 font-display text-2xl placeholder:text-rule focus:outline-none"
          />
          <button
            type="submit"
            disabled={!term.trim()}
            className="px-4 text-sm font-medium hover:text-accent disabled:text-muted"
          >
            Search
          </button>
        </form>
        {outcome?.kind === 'error' && <p className="mt-4 text-sm text-accent">{outcome.message}</p>}
      </Section>

      {blocked && <p className="text-muted">That word is part of a hidden name, so the search is off while names are hidden.</p>}

      {result && !blocked &&
        (result.total === 0 ? (
          <p className="text-muted">Nobody used “{result.term}” in this chat.</p>
        ) : (
          <>
            <p className="font-display text-2xl sm:text-3xl leading-snug max-w-3xl mb-12">
              “{result.term}” appears {result.total.toLocaleString()} {result.total === 1 ? 'time' : 'times'}
              {top && result.by_sender.length > 1 && (
                <>
                  , most often from <span className="text-accent">{label(top.sender)}</span> (
                  {top.count.toLocaleString()})
                </>
              )}
              .
            </p>

            <div className="grid lg:grid-cols-2 gap-x-10">
              <Section title="By person">
                <ul className="divide-y divide-rule border-y border-rule">
                  {result.by_sender.map((s) => (
                    <li key={s.sender} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-2.5 h-2.5" style={{ backgroundColor: color(s.sender) }} />
                      <span className="flex-1">{label(s.sender)}</span>
                      <span>{s.count.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Over time" note={index.granularity === 'month' ? 'By month' : 'By day'}>
                <ChartFrame
                  label={`Uses of “${result.term}” over time`}
                  table={{
                    headers: [index.granularity === 'month' ? 'Month' : 'Day', 'Uses'],
                    rows: result.timeline.slice(0, 60).map((t) => [periodLabel(t.date), t.count]),
                  }}
                  className="h-56 w-full"
                >
                  <ResponsiveContainer>
                    <BarChart
                      data={result.timeline.map((t) => ({ ...t, label: periodLabel(t.date) }))}
                      margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
                    >
                      <CartesianGrid {...gridProps} vertical={false} />
                      <XAxis dataKey="label" {...axisProps} minTickGap={40} />
                      <YAxis {...axisProps} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        cursor={{ fill: CURSOR_FILL }}
                        content={(p) => (
                          <ChartTip
                            {...p}
                            render={(d) => (
                              <>
                                {d.label}: <b>{d.count}</b>
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
          </>
        ))}
    </>
  );
};
