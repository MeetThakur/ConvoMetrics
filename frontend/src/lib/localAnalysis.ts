import type { ChatAnalytics } from '../types';

export const MAX_FILE_MB = 50;
const ACCEPTED = ['.txt', '.json', '.zip'];

export interface RangeParams {
  start: string | null;
  end: string | null;
}

export interface Progress {
  phase: 'preparing' | 'analysing';
  name: string;
}

export interface AnalysisRequest {
  file: File | null;
  range: RangeParams;
}

export type AnalysisReply =
  | { phase: Progress['phase'] }
  | { data: ChatAnalytics }
  | { error: string; restart?: boolean };

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

let worker: Worker | undefined;

export function releaseAnalysisWorker() {
  worker?.terminate();
  worker = undefined;
}

export function analyzeLocally(
  request: AnalysisRequest,
  onProgress: (progress: Progress) => void,
  signal: AbortSignal,
): Promise<ChatAnalytics> {
  if (request.file) {
    const problem = checkFile(request.file);
    if (problem) return Promise.reject(new Error(problem));
  }

  return new Promise((resolve, reject) => {
    const current = worker ??= new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => {
      current.removeEventListener('message', onMessage);
      current.removeEventListener('error', onError);
      current.removeEventListener('messageerror', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const onError = () => {
      cleanup();
      releaseAnalysisWorker();
      reject(new Error('The analysis worker stopped. Try a smaller export or another browser.'));
    };
    const onAbort = () => {
      cleanup();
      releaseAnalysisWorker();
      reject(signal.reason);
    };
    const onMessage = ({ data }: MessageEvent<AnalysisReply>) => {
      if ('phase' in data) {
        onProgress({ phase: data.phase, name: request.file?.name ?? 'Sample chat' });
        return;
      }

      cleanup();
      if ('error' in data) {
        if (data.restart) releaseAnalysisWorker();
        reject(new Error(data.error));
      } else {
        resolve(data.data);
      }
    };

    current.addEventListener('message', onMessage);
    current.addEventListener('error', onError);
    current.addEventListener('messageerror', onError);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    try {
      current.postMessage(request);
    } catch {
      onError();
    }
  });
}
