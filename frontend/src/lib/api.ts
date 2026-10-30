import { ChatAnalytics } from '../types';

export const MAX_FILE_MB = 50;
const ACCEPTED = ['.txt', '.json', '.zip'];

export interface RangeParams {
  start: string | null;
  end: string | null;
}

export interface Progress {
  phase: 'uploading' | 'analysing';
  pct: number;
  name: string;
}

/** Returns a message if the file can't be a chat export, so we don't upload it for nothing. */
export function checkFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!ACCEPTED.some((ext) => name.endsWith(ext))) {
    return 'That doesn’t look like a chat export. Use a WhatsApp .txt, a Telegram result.json, or a .zip of either.';
  }
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(0)} MB. The limit is ${MAX_FILE_MB} MB.`;
  }
  return null;
}

/** XHR rather than fetch, because fetch cannot report upload progress. */
export function analyzeFile(
  file: File,
  range: RangeParams,
  onProgress: (p: Progress) => void
): Promise<ChatAnalytics> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    if (range.start) form.append('start', range.start);
    if (range.end) form.append('end', range.end);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/analyze');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress({ phase: 'uploading', pct: Math.round((e.loaded / e.total) * 100), name: file.name });
      }
    };
    xhr.upload.onload = () => onProgress({ phase: 'analysing', pct: 100, name: file.name });
    xhr.onerror = () => reject(new Error('Could not reach the server. Is it running?'));
    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // non-JSON error page
      }
      if (xhr.status >= 200 && xhr.status < 300 && body) resolve(body);
      else reject(new Error(body?.detail || `The server returned an error (${xhr.status}).`));
    };
    xhr.send(form);
  });
}

export async function fetchSample(range: RangeParams): Promise<ChatAnalytics> {
  const q = new URLSearchParams();
  if (range.start) q.set('start', range.start);
  if (range.end) q.set('end', range.end);
  const res = await fetch(`/api/sample?${q}`);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) throw new Error(body?.detail || 'Could not load the sample chat.');
  return body;
}
