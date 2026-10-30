import React from 'react';
import { useNames } from '../lib/names';

interface SectionProps {
  title: string;
  note?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}

/** A ruled block with a small label on the left, used instead of cards. */
export const Section: React.FC<SectionProps> = ({ title, note, aside, children }) => (
  <section className="border-t border-ink pt-3 mb-12">
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-6">
      <div className="flex items-baseline gap-3">
        <h3 className="font-display text-xl">{title}</h3>
        {note && <p className="text-sm text-muted">{note}</p>}
      </div>
      {aside}
    </div>
    {children}
  </section>
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
      className="bg-transparent border border-ink px-2 py-1 text-sm text-ink cursor-pointer"
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
