import React from 'react';
import { ChatAnalytics } from '../types';
import { exportDailyCsv, exportJson, exportPeopleCsv } from '../lib/export';
import { useNames } from '../lib/names';

export const ExportBar: React.FC<{ data: ChatAnalytics }> = ({ data }) => {
  const names = useNames();
  const btn = 'px-3 py-1.5 border border-ink text-sm hover:bg-ink hover:text-paper';

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button className={btn} onClick={() => exportJson(data, names)}>
          All stats (JSON)
        </button>
        <button className={btn} onClick={() => exportPeopleCsv(data, names)}>
          People (CSV)
        </button>
        <button className={btn} onClick={() => exportDailyCsv(data)}>
          Messages per day (CSV)
        </button>
      </div>
      <p className="mt-3 text-sm text-muted">
        Exports follow what is on screen: hidden or renamed people stay hidden or renamed.
        {names.hidden && ' Words and emoji lists can still contain names that people mentioned.'}
      </p>
    </div>
  );
};
