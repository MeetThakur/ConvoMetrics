import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { WordsData, ParticipantStat } from '../../types';
import { INK, axisProps, gridProps, ChartTip, CURSOR_FILL } from '../../lib/theme';
import { useNames } from '../../lib/names';
import { ChartFrame } from '../ChartFrame';
import { Section, UserSelect } from '../Section';

interface WordsTabProps {
  words: WordsData;
  participants: ParticipantStat[];
  onSelectWord: (word: string) => void;
}

export const WordsTab: React.FC<WordsTabProps> = ({ words, participants, onSelectWord }) => {
  const [user, setUser] = useState('All');
  const { isNameWord } = useNames();
  // With names hidden, drop words that are someone's name so they don't give the person away.
  const list = (user === 'All' ? words.overall : words.by_sender[user] || []).filter(
    (w) => !isNameWord(w.word)
  );
  const max = list[0]?.count || 1;

  return (
    <>
      <Section
        title="Most used words"
        note="Common filler words are left out. Click a word to see who says it."
        aside={<UserSelect value={user} names={participants.map((p) => p.name)} onChange={setUser} />}
      >
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          {list.map((item) => (
            <button
              key={item.word}
              onClick={() => onSelectWord(item.word)}
              style={{ fontSize: `${1 + (item.count / max) * 1.6}rem` }}
              className="font-display leading-tight hover:text-accent"
              title={`${item.count} times`}
            >
              {item.word}
            </button>
          ))}
        </div>
      </Section>

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
              <Bar dataKey="count" fill={INK} barSize={14} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </Section>
    </>
  );
};
