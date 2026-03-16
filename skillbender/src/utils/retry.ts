/**
 * Retry with exponential backoff + jitter.
 * Never retries on permanent errors (4xx except 429).
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number;
  /** Return true to abort without retrying */
  isPermanentError?: (err: unknown) => boolean;
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void;
}

const DEFAULT_PERMANENT_STATUS = new Set([400, 401, 403, 404, 422]);

function isPermanentByDefault(err: unknown): boolean {
  if (err instanceof Error && 'status' in err) {
    const status = (err as { status: number }).status;
    return DEFAULT_PERMANENT_STATUS.has(status);
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    jitterFactor = 0.3,
    isPermanentError = isPermanentByDefault,
    onRetry,
  } = options;

  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      if (isPermanentError(err)) throw err;
      if (attempt === maxAttempts - 1) break;

      const backoff = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitter = backoff * jitterFactor * Math.random();
      const delayMs = Math.floor(backoff + jitter);

      onRetry?.(attempt + 1, err, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastErr;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
