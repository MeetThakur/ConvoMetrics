import React, { useState } from 'react';
import { EmojisData, ParticipantStat } from '../../types';
import { Section, UserSelect } from '../Section';

interface EmojiTabProps {
  emojis: EmojisData;
  participants: ParticipantStat[];
}

export const EmojiTab: React.FC<EmojiTabProps> = ({ emojis, participants }) => {
  const [user, setUser] = useState('All');
  const list = (user === 'All' ? emojis.overall : emojis.by_sender[user] || []).slice(0, 10);
  const max = list[0]?.count || 1;

  return (
    <Section
      title="Top ten"
      note="Most used emoji"
      aside={<UserSelect value={user} names={participants.map((p) => p.name)} onChange={setUser} />}
    >
      {list.length === 0 ? (
        <p className="text-muted">No emoji found.</p>
      ) : (
        <ol className="divide-y divide-rule border-y border-rule">
          {list.map((item, i) => (
            <li key={item.emoji} className="grid grid-cols-[2rem_3rem_1fr_4rem] items-center gap-3 py-2">
              <span className="text-sm text-muted">{i + 1}</span>
              <span className="text-2xl leading-none">{item.emoji}</span>
              <span className="h-2 bg-rule/60">
                <span
                  className="block h-full bg-ink"
                  style={{ width: `${(item.count / max) * 100}%` }}
                />
              </span>
              <span className="text-sm text-right">{item.count.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
};
