/**
 * Bounded retry with exponential backoff for transient NeverSkip API failures
 * (network errors, timeouts, HTTP 429 / 5xx). Auth failures are never retried.
 */

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  label?: string;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (info: { attempt: number; delayMs: number; reason: string }) => void;
};

export const DEFAULT_RETRY_ATTEMPTS = 3;

export function isTransientHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export function backoffDelayMs(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  return Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
}

/**
 * Run `fn` up to `attempts` times. `fn` returns `{ retry: true, reason }` to request
 * another attempt, or `{ retry: false, value }` to finish.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<{ retry: false; value: T } | { retry: true; reason: string; value: T }>,
  options: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? DEFAULT_RETRY_ATTEMPTS);
  const base = options.baseDelayMs ?? 2000;
  const max = options.maxDelayMs ?? 15_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last: T | undefined;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const result = await fn(attempt);
    last = result.value;
    if (!result.retry || attempt === attempts) return result.value;
    const delayMs = backoffDelayMs(attempt, base, max);
    options.onRetry?.({ attempt, delayMs, reason: result.reason });
    await sleep(delayMs);
  }
  return last as T;
}
