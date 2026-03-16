import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../src/utils/retry.js';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient errors', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 1,
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on permanent errors', async () => {
    const permError = Object.assign(new Error('bad request'), { status: 400 });
    const fn = vi.fn().mockRejectedValue(permError);

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })
    ).rejects.toThrow('bad request');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('exhausts retries and throws last error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })
    ).rejects.toThrow('always fails');

    expect(fn).toHaveBeenCalledTimes(3);
  });
});
