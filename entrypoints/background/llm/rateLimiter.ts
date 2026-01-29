/**
 * Rate limiter with exponential backoff for LLM API calls
 * Uses exponential-backoff library for retry handling
 */

import { backOff } from 'exponential-backoff';

/**
 * Error with HTTP status code (for rate limit detection)
 */
interface HTTPError extends Error {
  status?: number;
  headers?: Record<string, string>;
}

/**
 * Rate limit tracking state
 */
interface RateLimitState {
  /** Timestamp of last successful request */
  lastRequest: number;
  /** Timestamp until which requests should be blocked */
  retryAfter: number | null;
  /** Count of consecutive rate limit errors */
  consecutiveErrors: number;
}

/**
 * Rate limiter class that handles 429 errors with exponential backoff
 *
 * Features:
 * - Exponential backoff with jitter to avoid thundering herd
 * - Only retries 429 rate limit errors
 * - Respects retry-after headers from API
 * - Non-429 errors are thrown immediately
 */
export class RateLimiter {
  private state: RateLimitState = {
    lastRequest: 0,
    retryAfter: null,
    consecutiveErrors: 0,
  };

  /**
   * Execute a function with rate limiting and exponential backoff
   * @param fn - Async function to execute
   * @returns Promise resolving to the function result
   * @throws Error if rate limited or function fails with non-429 error
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if currently rate limited
    if (this.state.retryAfter && Date.now() < this.state.retryAfter) {
      const waitMs = this.state.retryAfter - Date.now();
      throw new Error(`Rate limited. Retry after ${Math.ceil(waitMs / 1000)}s`);
    }

    return backOff(
      async () => {
        try {
          this.state.lastRequest = Date.now();
          const result = await fn();
          // Success - reset error state
          this.state.consecutiveErrors = 0;
          this.state.retryAfter = null;
          return result;
        } catch (error) {
          const httpError = error as HTTPError;

          if (httpError.status === 429) {
            // Parse retry-after header if present
            const retryAfter = httpError.headers?.['retry-after'];
            if (retryAfter) {
              const retrySeconds = parseInt(retryAfter, 10);
              if (!isNaN(retrySeconds)) {
                this.state.retryAfter = Date.now() + (retrySeconds * 1000);
              }
            }
            this.state.consecutiveErrors++;
            throw error; // Let backOff handle retry
          }

          // Non-429 errors are thrown immediately without retry
          throw error;
        }
      },
      {
        numOfAttempts: 5,
        startingDelay: 1000,
        timeMultiple: 2,
        maxDelay: 30000,
        jitter: 'full', // Add randomness to avoid thundering herd
        retry: (error: unknown) => {
          const httpError = error as HTTPError;
          return httpError.status === 429;
        },
      }
    );
  }

  /**
   * Get current rate limit state (for debugging/monitoring)
   */
  getState(): Readonly<RateLimitState> {
    return { ...this.state };
  }

  /**
   * Check if currently rate limited
   */
  isRateLimited(): boolean {
    return !!(this.state.retryAfter && Date.now() < this.state.retryAfter);
  }

  /**
   * Reset rate limit state
   */
  reset(): void {
    this.state = {
      lastRequest: 0,
      retryAfter: null,
      consecutiveErrors: 0,
    };
  }
}
