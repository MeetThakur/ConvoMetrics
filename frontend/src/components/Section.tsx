import React from 'react';
import { useNames } from '../lib/names';
import { Reveal } from '../lib/motion';

interface SectionProps {
  title: string;
  note?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** A ruled block with a small label on the left, used instead of cards. Fades in as it scrolls into view. */
export const Section: React.FC<SectionProps> = ({ title, note, aside, children, className = '' }) => (
  <Reveal as="section" className={`border-t border-ink pt-3 mb-12 ${className}`}>
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-display text-xl">{title}</h3>
        {note && <p className="text-sm text-muted">{note}</p>}
      </div>
      {aside}
    </div>
    {children}
  </Reveal>
);

interface UserSelectProps {
  value: string;
  names: string[];
  onChange: (v: string) => void;
}

export const UserSelect: React.FC<UserSelectProps> = ({ value, names, onChange }) => {
  const { label } = useNames();
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Show
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent border border-ink px-2 py-1 text-sm text-ink cursor-pointer transition-colors hover:bg-ink/5"
      >
        <option value="All">Everyone</option>
        {names.map((n) => (
          <option key={n} value={n}>
            {label(n)}
          </option>
        ))}
      </select>
    </label>
  );
};

/** Small ranked list with a hairline between rows. */
export const RankedList: React.FC<{ children: React.ReactNode; ordered?: boolean; className?: string }> = ({
  children,
  ordered = true,
  className = '',
}) => {
  const Tag = ordered ? 'ol' : 'ul';
  return <Tag className={`divide-y divide-rule border-y border-rule ${className}`}>{children}</Tag>;
};

/** Short table styles, shared so every table in the app lines up. */
export const th = 'py-2 font-medium';
export const thead = 'text-xs uppercase tracking-wider text-muted border-b border-rule';
