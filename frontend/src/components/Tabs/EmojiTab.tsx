import React, { useState } from 'react';
import { EmojisData, ParticipantStat } from '../../types';
import { useInView } from '../../lib/motion';
import { useNames } from '../../lib/names';
import { Section, UserSelect } from '../Section';

interface EmojiTabProps {
  emojis: EmojisData;
  participants: ParticipantStat[];
}

export const EmojiTab: React.FC<EmojiTabProps> = ({ emojis, participants }) => {
  const [user, setUser] = useState('All');
  const { label, color } = useNames();
  const list = (user === 'All' ? emojis.overall : emojis.by_sender[user] || []).slice(0, 10);
  const max = list[0]?.count || 1;
  const [ref, seen] = useInView<HTMLDivElement>();

  // Each person's single favourite, for the strip at the top.
  const favourites = participants
    .map((p) => ({ name: p.name, top: emojis.by_sender[p.name]?.[0] }))
    .filter((f) => f.top);

  return (
    <>
      {favourites.length > 1 && (
        <Section title="Everyone's favourite">
          <ul className="flex flex-wrap gap-x-10 gap-y-6">
            {favourites.map((f, i) => (
              <li key={f.name} className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="text-4xl leading-none rise-in"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  {f.top!.emoji}
                </span>
                <div>
                  <div className="font-medium flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5" style={{ backgroundColor: color(f.name) }} />
                    {label(f.name)}
                  </div>
                  <div className="text-sm text-muted">{f.top!.count.toLocaleString()} times</div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Top ten"
        note="Most used emoji"
        aside={<UserSelect value={user} names={participants.map((p) => p.name)} onChange={setUser} />}
      >
        {list.length === 0 ? (
          <p className="text-muted">No emoji found.</p>
        ) : (
          <div ref={ref} className={seen ? 'is-in' : ''}>
            <ol className="divide-y divide-rule border-y border-rule">
              {list.map((item, i) => (
                <li key={item.emoji} className="grid grid-cols-[2rem_3rem_1fr_4rem] items-center gap-3 py-2">
                  <span className="text-sm text-muted">{i + 1}</span>
                  <span className="text-2xl leading-none">{item.emoji}</span>
                  <span className="h-2 bg-rule/60">
                    <span
                      className="block h-full bg-ink grow-x"
                      style={{ width: `${(item.count / max) * 100}%`, transitionDelay: `${i * 50}ms` }}
                    />
                  </span>
                  <span className="text-sm text-right">{item.count.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Section>
    </>
  );
};
