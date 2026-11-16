import React from 'react';
import { Insights } from '../../types';
import { useNames } from '../../lib/names';
import { Bars } from '../Bars';
import { StatGrid } from '../StatGrid';
import { Section } from '../Section';

export const MediaTab: React.FC<{ media: Insights['media']; deleted: number | null }> = ({ media, deleted }) => {
  const { label, color } = useNames();
  return (
    <>
      <StatGrid
        cols={4}
        className="mb-12"
        stats={[
          { label: 'Photos, videos, stickers', value: media.media_total },
          { label: 'Share of messages', value: media.media_share, decimals: 1, suffix: '%' },
          { label: 'Links shared', value: media.links_total },
          { label: 'Deleted messages', value: deleted === null ? '—' : deleted },
        ]}
      />
      {deleted === null && (
        <p className="-mt-8 mb-12 text-sm text-muted">
          Deleted messages carry no date, so they can't be counted inside a date range.
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-x-10">
        <Section title="Media by person">
          <Bars items={media.per_sender.map((p) => ({ label: label(p.name), value: p.media, color: color(p.name) }))} />
        </Section>
        <Section title="Links by person">
          <Bars items={media.per_sender.map((p) => ({ label: label(p.name), value: p.links, color: color(p.name) }))} />
        </Section>
      </div>

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
