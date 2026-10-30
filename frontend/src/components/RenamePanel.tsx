import React, { useState } from 'react';
import { useNames } from '../lib/names';

const looksLikePhone = (n: string) => /^\+?[\d\s()-]{7,}$/.test(n);

export const RenamePanel: React.FC<{ people: string[] }> = ({ people }) => {
  const { custom, rename, hidden } = useNames();
  const [open, setOpen] = useState(false);
  const hasPhones = people.some(looksLikePhone);

  return (
    <div className="mb-10 -mt-4 text-sm">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="text-muted underline underline-offset-4 decoration-rule hover:text-ink"
      >
        {open ? 'Done renaming' : 'Rename people'}
      </button>
      {hasPhones && !open && (
        <span className="ml-3 text-muted">Some names look like phone numbers.</span>
      )}

      {open && (
        <div className="mt-4">
          {hidden && (
            <p className="mb-3 text-muted">Names are hidden right now. Custom names show again when you show names.</p>
          )}
          <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
            {people.map((name) => (
              <li key={name} className="flex items-center gap-3">
                <span className="w-32 truncate text-muted" title={name}>
                  {name}
                </span>
                <input
                  type="text"
                  value={custom[name] ?? ''}
                  onChange={(e) => rename(name, e.target.value)}
                  placeholder="Show as…"
                  aria-label={`Display name for ${name}`}
                  className="flex-1 min-w-0 bg-transparent border-b border-rule py-1 focus:border-ink focus:outline-none"
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
