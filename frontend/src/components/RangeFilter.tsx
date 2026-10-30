import React, { useEffect, useState } from 'react';
import { DateRange } from '../types';
import { RangeParams } from '../lib/api';

interface RangeFilterProps {
  range: DateRange;
  disabled: boolean;
  onApply: (range: RangeParams) => void;
}

export const RangeFilter: React.FC<RangeFilterProps> = ({ range, disabled, onApply }) => {
  const [from, setFrom] = useState(range.start ?? range.full_start);
  const [to, setTo] = useState(range.end ?? range.full_end);

  // Keep the inputs in step when a chip (or a new file) changes the applied range.
  useEffect(() => {
    setFrom(range.start ?? range.full_start);
    setTo(range.end ?? range.full_end);
  }, [range]);

  const isAll = !range.start && !range.end;
  const chip = (active: boolean) =>
    `px-3 py-1 text-sm border ${
      active ? 'bg-ink text-paper border-ink' : 'border-rule text-muted hover:text-ink hover:border-ink'
    } disabled:opacity-50`;
  const dateInput = 'bg-transparent border border-rule px-2 py-1 text-sm text-ink';

  return (
    <div className="mb-10 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
        <button
          className={chip(isAll)}
          disabled={disabled}
          onClick={() => onApply({ start: null, end: null })}
        >
          All time
        </button>
        {range.years.length > 1 &&
          range.years.map((y) => {
            const start = `${y.year}-01-01`;
            const end = `${y.year}-12-31`;
            return (
              <button
                key={y.year}
                className={chip(range.start === start && range.end === end)}
                disabled={disabled}
                onClick={() => onApply({ start, end })}
              >
                {y.year}
              </button>
            );
          })}
      </div>

      <form
        className="flex flex-wrap items-center gap-2 text-sm text-muted"
        onSubmit={(e) => {
          e.preventDefault();
          onApply({ start: from || null, end: to || null });
        }}
      >
        <label className="flex items-center gap-2">
          From
          <input
            type="date"
            value={from}
            min={range.full_start}
            max={range.full_end}
            onChange={(e) => setFrom(e.target.value)}
            className={dateInput}
          />
        </label>
        <label className="flex items-center gap-2">
          to
          <input
            type="date"
            value={to}
            min={range.full_start}
            max={range.full_end}
            onChange={(e) => setTo(e.target.value)}
            className={dateInput}
          />
        </label>
        <button
          type="submit"
          disabled={disabled || !from || !to}
          className="px-3 py-1 border border-ink text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
        >
          {disabled ? 'Updating…' : 'Apply'}
        </button>
      </form>
    </div>
  );
};
