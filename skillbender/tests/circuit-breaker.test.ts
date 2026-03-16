import { describe, it, expect, vi } from 'vitest';
import { CircuitBreaker } from '../src/utils/circuit-breaker.js';

describe('CircuitBreaker', () => {
  it('starts in CLOSED state', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    expect(cb.currentState).toBe('CLOSED');
    expect(cb.isOpen()).toBe(false);
  });

  it('opens after threshold failures', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 2, name: 'test' });
    const failFn = () => Promise.reject(new Error('fail'));

    await expect(cb.call(failFn)).rejects.toThrow();
    await expect(cb.call(failFn)).rejects.toThrow();

    expect(cb.currentState).toBe('OPEN');
    expect(cb.isOpen()).toBe(true);
  });

  it('throws immediately when OPEN', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, name: 'test' });
    const failFn = () => Promise.reject(new Error('fail'));

    await expect(cb.call(failFn)).rejects.toThrow('fail');
    expect(cb.currentState).toBe('OPEN');

    await expect(cb.call(() => Promise.resolve('ok'))).rejects.toThrow(
      'Circuit breaker [test] is OPEN'
    );
  });

  it('resets to CLOSED on success', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3 });
    const failFn = () => Promise.reject(new Error('fail'));
    const successFn = () => Promise.resolve('ok');

    await expect(cb.call(failFn)).rejects.toThrow();
    await expect(cb.call(failFn)).rejects.toThrow();
    expect(cb.currentState).toBe('CLOSED'); // not yet at threshold

    await cb.call(successFn);
    expect(cb.currentState).toBe('CLOSED');
  });
});
