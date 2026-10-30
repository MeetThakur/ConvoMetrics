import React from 'react';
import { Insights } from '../../types';
import { useNames } from '../../lib/names';
import { Bars } from '../Bars';
import { Section } from '../Section';

export const MediaTab: React.FC<{ media: Insights['media']; deleted: number | null }> = ({ media, deleted }) => {
  const { label } = useNames();
  return (
    <>
      <dl className="grid grid-cols-2 sm:grid-cols-4 border-y border-ink mb-12">
        {[
          ['Photos, videos, stickers', media.media_total.toLocaleString()],
          ['Share of messages', `${media.media_share}%`],
          ['Links shared', media.links_total.toLocaleString()],
          ['Deleted messages', deleted === null ? '—' : deleted.toLocaleString()],
        ].map(([name, value], i) => (
          <div key={name} className={`py-4 px-4 first:pl-0 ${i > 0 ? 'sm:border-l border-rule' : ''}`}>
            <dt className="text-xs uppercase tracking-wider text-muted mb-1">{name}</dt>
            <dd className="font-display text-2xl">{value}</dd>
          </div>
        ))}
      </dl>
      {deleted === null && (
        <p className="-mt-8 mb-12 text-sm text-muted">
          Deleted messages carry no date, so they can't be counted inside a date range.
        </p>
      )}

      <Section title="Who shares what">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted border-b border-rule">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 px-4 font-medium text-right">Media</th>
              <th className="py-2 pl-4 font-medium text-right">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {media.per_sender.map((p) => (
              <tr key={p.name}>
                <td className="py-3 pr-4 font-medium">{label(p.name)}</td>
                <td className="py-3 px-4 text-right">{p.media.toLocaleString()}</td>
                <td className="py-3 pl-4 text-right">{p.links.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {media.links_total > 0 && (
        <div className="grid md:grid-cols-2 gap-x-10">
          <Section title="Where links go" note="By site">
            <Bars items={media.platforms.map((p) => ({ label: p.name, value: p.count }))} />
          </Section>
          <Section title="Top domains">
            <Bars items={media.top_domains.map((d) => ({ label: d.name, value: d.count }))} />
          </Section>
        </div>
      )}
    </>
  );
};
