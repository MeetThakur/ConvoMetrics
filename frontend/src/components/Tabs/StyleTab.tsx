import React from 'react';
import { Insights } from '../../types';
import { useNames } from '../../lib/names';
import { Bars } from '../Bars';
import { Section } from '../Section';

interface StyleTabProps {
  style: Insights['style'];
  tone: Insights['tone'];
  vocabulary: Insights['vocabulary'];
}

export const StyleTab: React.FC<StyleTabProps> = ({ style, tone, vocabulary }) => {
  const { label, color, scrub } = useNames();

  const perPerson = <T extends { name: string; messages: number }>(
    rows: T[],
    key: keyof T & string,
    share: (r: T) => number
  ) =>
    rows
      .map((p) => ({
        label: label(p.name),
        value: p[key] as unknown as number,
        color: color(p.name),
        detail: `(${share(p).toFixed(0)}%)`,
      }))
      .sort((a, b) => b.value - a.value);

  const pct = (n: number, d: number) => (n / Math.max(d, 1)) * 100;

  const metrics: { title: string; note: string; items: ReturnType<typeof perPerson> }[] = [
    { title: 'Questions', note: 'Messages with a ?', items: perPerson(style, 'questions', (p) => pct(p.questions, p.messages)) },
    { title: 'Exclamations', note: 'Messages with a !', items: perPerson(style, 'exclamations', (p) => pct(p.exclamations, p.messages)) },
    { title: 'Laughter', note: 'haha, lol, 😂 and friends', items: perPerson(tone, 'laughs', (p) => p.laugh_share) },
    { title: 'Shouting', note: 'Messages in ALL CAPS', items: perPerson(tone, 'caps', (p) => p.caps_share) },
    { title: 'Emoji only', note: 'Messages that are nothing but emoji', items: perPerson(tone, 'emoji_only', (p) => pct(p.emoji_only, p.messages)) },
    { title: 'Late nights', note: 'Messages between midnight and 5 AM', items: perPerson(style, 'night', (p) => pct(p.night, p.messages)) },
  ];

  const longest = vocabulary.longest_message;

  return (
    <>
      <div className="grid md:grid-cols-2 gap-x-10">
        {metrics.map((m) => (
          <Section key={m.title} title={m.title} note={m.note}>
            <Bars items={m.items} />
          </Section>
        ))}
        <p className="md:col-span-2 text-sm text-muted -mt-6 mb-12">
          Percentages are the share of that person's own messages.
        </p>
      </div>

      <Section title="Vocabulary" note="Different words each person uses. Richness is unique words ÷ √total, so it is fair across people who write different amounts.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-muted border-b border-rule">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 px-4 font-medium text-right">Words</th>
                <th className="py-2 px-4 font-medium text-right">Different words</th>
                <th className="py-2 pl-4 font-medium text-right">Richness</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {vocabulary.per_sender.map((p) => (
                <tr key={p.name} className="transition-colors hover:bg-ink/[0.03]">
                  <td className="py-3 pr-4 font-medium">
                    <span className="inline-block w-2.5 h-2.5 mr-2" style={{ backgroundColor: color(p.name) }} />
                    {label(p.name)}
                  </td>
                  <td className="py-3 px-4 text-right">{p.words.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right">{p.unique_words.toLocaleString()}</td>
                  <td className="py-3 pl-4 text-right">{p.richness}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {longest && (
          <figure className="mt-8 max-w-2xl">
            <figcaption className="text-xs uppercase tracking-wider text-muted mb-2">
              Longest message · {label(longest.sender)}, {longest.date} · {longest.words.toLocaleString()} words
            </figcaption>
            <blockquote className="font-display text-lg leading-snug border-l-2 border-accent pl-4 text-ink/90">
              “{scrub(longest.preview)}
              {longest.preview.length >= 160 ? '…' : ''}”
            </blockquote>
          </figure>
        )}
      </Section>
    </>
  );
};
