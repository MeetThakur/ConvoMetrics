import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Insights, WordsData, ParticipantStat } from '../../types';
import { INK, axisProps, gridProps, ChartTip, CURSOR_FILL } from '../../lib/theme';
import { useNames } from '../../lib/names';
import { useInView } from '../../lib/motion';
import { ChartFrame, anim } from '../ChartFrame';
import { Section, UserSelect, RankedList } from '../Section';

interface WordsTabProps {
  words: WordsData;
  participants: ParticipantStat[];
  vocabulary: Insights['vocabulary'];
  common: Insights['common_messages'];
  onSelectWord: (word: string) => void;
}

export const WordsTab: React.FC<WordsTabProps> = ({ words, participants, vocabulary, common, onSelectWord }) => {
  const [user, setUser] = useState('All');
  const { isNameWord, label, color, scrub } = useNames();
  // With names hidden, drop words that are someone's name so they don't give the person away.
  const list = (user === 'All' ? words.overall : words.by_sender[user] || []).filter(
    (w) => !isNameWord(w.word)
  );
  const max = list[0]?.count || 1;
  const [cloudRef, cloudSeen] = useInView<HTMLDivElement>();
  const signatures = vocabulary.per_sender.filter((p) => p.signature.length > 0);

  return (
    <>
      <Section
        title="Most used words"
        note="Common filler words are left out. Click a word to see who says it."
        aside={<UserSelect value={user} names={participants.map((p) => p.name)} onChange={setUser} />}
      >
        <div ref={cloudRef} className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          {list.map((item, i) => (
            <button
              key={item.word}
              onClick={() => onSelectWord(item.word)}
              style={{
                fontSize: `${1 + (item.count / max) * 1.6}rem`,
                opacity: cloudSeen ? 1 : 0,
                transform: cloudSeen ? 'none' : 'translateY(8px)',
                transition: `opacity 500ms ease ${Math.min(i, 14) * 40}ms, transform 500ms ease ${Math.min(i, 14) * 40}ms, color 200ms`,
              }}
              className="font-display leading-tight hover:text-accent"
              title={`${item.count} times`}
            >
              {item.word}
            </button>
          ))}
        </div>
      </Section>

      {signatures.length > 1 && (
        <Section title="Signature words" note="Words each person uses far more than the others do. Click one to search it.">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
            {signatures.map((p) => (
              <div key={p.name}>
                <h4 className="flex items-center gap-2 font-medium mb-3">
                  <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: color(p.name) }} />
                  {label(p.name)}
                </h4>
                <ul className="flex flex-wrap gap-2">
                  {p.signature
                    .filter((s) => !isNameWord(s.word))
                    .map((s) => (
                      <li key={s.word}>
                        <button
                          onClick={() => onSelectWord(s.word)}
                          title={`${s.count.toLocaleString()} times, ${s.lift}× more than others`}
                          className="border border-rule px-2.5 py-1 text-sm transition-colors hover:border-ink hover:bg-ink/[0.04]"
                        >
                          {s.word} <span className="text-muted">{s.lift}×</span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="grid lg:grid-cols-2 gap-x-10">
        <Section title="Top 15" note="Number of times used">
          <ChartFrame
            label="Top 15 most used words"
            table={{ headers: ['Word', 'Times used'], rows: list.slice(0, 15).map((w) => [w.word, w.count]) }}
            className="h-[26rem] w-full"
          >
            <ResponsiveContainer>
              <BarChart
                layout="vertical"
                data={list.slice(0, 15)}
                margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid {...gridProps} horizontal={false} />
                <XAxis type="number" {...axisProps} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="word"
                  width={90}
                  {...axisProps}
                  tick={{ fill: INK, fontSize: 13 }}
                />
                <Tooltip
                  cursor={{ fill: CURSOR_FILL }}
                  content={(p) => (
                    <ChartTip
                      {...p}
                      render={(d) => (
                        <>
                          “{d.word}”: <b>{d.count.toLocaleString()}</b>
                        </>
                      )}
                    />
                  )}
                />
                <Bar dataKey="count" fill={INK} barSize={14} {...anim} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </Section>

        {common.length > 0 && (
          <Section title="Said on repeat" note="Exact messages sent again and again">
            <RankedList>
              {common.map((m, i) => (
                <li key={m.text} className="grid grid-cols-[2rem_1fr_auto] gap-3 py-2 text-sm items-baseline">
                  <span className="text-muted">{i + 1}</span>
                  <span className="truncate">
                    <span className="font-display text-base">“{scrub(m.text)}”</span>{' '}
                    <span className="text-muted">
                      · mostly {label(m.top_sender)}
                    </span>
                  </span>
                  <span className="font-medium">{m.count.toLocaleString()}×</span>
                </li>
              ))}
            </RankedList>
          </Section>
        )}
      </div>
    </>
  );
};
