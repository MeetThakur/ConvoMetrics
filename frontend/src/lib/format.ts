/** 0.4 -> "under a minute", 75 -> "1 h 15 min", 3000 -> "2.1 days" */
export function formatDuration(minutes: number): string {
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  return `${(minutes / 1440).toFixed(1)} days`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2023-01-07" -> "Jan 7, 2023". Falls back to the input if it isn't an ISO date. */
export function formatDate(iso: string, withYear = true): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${MONTHS[Number(mo) - 1]} ${Number(d)}${withYear ? `, ${y}` : ''}`;
}

/** 700 -> "1 year 11 months", 45 -> "6 weeks", 5 -> "5 days" */
export function formatSpan(days: number): string {
  if (days < 14) return `${days} ${days === 1 ? 'day' : 'days'}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = `${years} ${years === 1 ? 'year' : 'years'}`;
  return rest ? `${y} ${rest} ${rest === 1 ? 'month' : 'months'}` : y;
}

/** 12345 -> "12.3k", 1234567 -> "1.2M" */
export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return n.toLocaleString();
}

export const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;
