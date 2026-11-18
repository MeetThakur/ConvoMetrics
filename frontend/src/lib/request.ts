/** Retry only explicit rate-limit responses, once, without ignoring Retry-After. */
export class HttpError extends Error {
  status: number;
  retryAfterMs: number;

  constructor(status: number, detail: unknown, retryAfter: string | null) {
    const delay = retryDelay(retryAfter);
    super(status === 429
      ? `Too many requests. Please wait ${Math.ceil(delay / 1000)} seconds before trying again.`
      : typeof detail === 'string' && detail ? detail : `The server returned an error (${status}).`);
    this.status = status;
    this.retryAfterMs = delay;
  }
}

export function retryDelay(value: string | null, now = Date.now()): number {
  if (!value?.trim()) return 10_000;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) && delay >= 0 ? Math.max(1000, delay) : 10_000;
}

export async function withRateLimitRetry<T>(request: () => Promise<T>, onRetry: () => void): Promise<T> {
  try {
    return await request();
  } catch (error) {
    // Longer waits remain user-controlled. Never retry parsing errors, other
    // HTTP failures or network failures where completion is unknown.
    if (!(error instanceof HttpError) || error.status !== 429 || error.retryAfterMs > 60_000) throw error;
    onRetry();
    await new Promise<void>((resolve) => setTimeout(resolve, error.retryAfterMs));
    return request();
  }
}
