import { SearchResult, WordIndex } from '../types';

/** Mirrors backend tokenize(): lowercase, drop ASCII punctuation. */
export function normalise(term: string): string {
  return term.toLowerCase().replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, '').trim();
}

export type SearchOutcome =
  | { kind: 'result'; result: SearchResult }
  | { kind: 'error'; message: string };

export function searchIndex(index: WordIndex, raw: string): SearchOutcome {
  const term = normalise(raw);
  if (!term) return { kind: 'error', message: 'Type a word to search for.' };
  if (/\s/.test(term)) return { kind: 'error', message: 'Search one word at a time.' };

  const hit = Object.prototype.hasOwnProperty.call(index.words, term) ? index.words[term] : undefined;
  if (!hit) return { kind: 'result', result: { term, total: 0, by_sender: [], timeline: [] } };

  const [total, senders, periods] = hit;
  return {
    kind: 'result',
    result: {
      term,
      total,
      by_sender: senders
        .map(([i, count]) => ({ sender: index.senders[i], count }))
        .sort((a, b) => b.count - a.count),
      timeline: periods.map(([i, count]) => ({ date: index.periods[i], count })),
    },
  };
}
