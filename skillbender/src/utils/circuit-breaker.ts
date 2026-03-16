/**
 * Circuit breaker for LLM provider calls.
 * States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit */
  failureThreshold?: number;
  /** Time in ms before moving from OPEN to HALF_OPEN */
  resetTimeoutMs?: number;
  /** Name for logging */
  name?: string;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureAt: number | null = null;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 60_000;
    this.name = options.name ?? 'circuit-breaker';
  }

  get currentState(): CircuitState {
    return this.state;
  }

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (this.lastFailureAt && now - this.lastFailureAt >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error(`Circuit breaker [${this.name}] is OPEN. Service unavailable.`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureAt = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureAt = null;
  }
}
