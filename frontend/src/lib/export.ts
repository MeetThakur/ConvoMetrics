import { ChatAnalytics } from '../types';

function download(filename: string, mime: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Quote anything with a delimiter, quote or newline. Prefix formula starters so Excel won't run them.
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';

interface Names {
  label: (n: string) => string;
  scrub: (t: string) => string;
}

/** Rewrites every name, in values and in object keys, so exports match what's on screen. */
function mapNames(value: unknown, names: Names, key?: string): unknown {
  if (typeof value === 'string') return key === 'first_msg' ? names.scrub(value) : names.label(value);
  if (Array.isArray(value)) return value.map((v) => mapNames(v, names));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [names.label(k), mapNames(v, names, k)])
    );
  }
  return value;
}

export function exportJson(data: ChatAnalytics, names: Names) {
  // The word index is for in-browser search and would bloat the file.
  const { word_index: _omit, ...rest } = data;
  const body = mapNames(rest, names);
  download('convometrics-stats.json', 'application/json', JSON.stringify(body, null, 2));
}

export function exportPeopleCsv(data: ChatAnalytics, names: Names) {
  const { insights: ins } = data;
  const by = <T extends { name: string }>(rows: T[]) => new Map(rows.map((r) => [r.name, r]));
  const reply = by(ins.responsiveness.per_sender);
  const style = by(ins.style);
  const media = by(ins.media.per_sender);
  const runs = by(ins.double_texting);

  const rows: unknown[][] = [
    [
      'name', 'messages', 'share_percent', 'words', 'avg_words_per_message', 'emojis',
      'median_reply_minutes', 'questions', 'exclamations', 'late_night_messages',
      'media', 'links', 'longest_run_in_a_row',
    ],
    ...data.participants.map((p) => [
      names.label(p.name), p.messages, p.percentage, p.words, p.avg_words, p.emojis,
      reply.get(p.name)?.median_minutes, style.get(p.name)?.questions, style.get(p.name)?.exclamations,
      style.get(p.name)?.night, media.get(p.name)?.media, media.get(p.name)?.links, runs.get(p.name)?.run,
    ]),
  ];
  download('convometrics-people.csv', 'text/csv', toCsv(rows));
}

export function exportDailyCsv(data: ChatAnalytics) {
  const rows: unknown[][] = [['date', 'messages'], ...data.timeline.daily.map((d) => [d.date, d.count])];
  download('convometrics-daily.csv', 'text/csv', toCsv(rows));
}
