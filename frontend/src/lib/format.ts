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
