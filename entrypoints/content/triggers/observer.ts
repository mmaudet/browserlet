/**
 * Debounced MutationObserver for trigger condition monitoring
 * Optimized for performance with Page Visibility API integration
 */

export type ObserverCallback = () => void;

/**
 * Create a debounced MutationObserver
 * @param callback - Function to call after debounce period
 * @param delay - Debounce delay in milliseconds (default 500ms from research)
 * @returns MutationObserver instance
 */
export function createDebouncedObserver(
  callback: ObserverCallback,
  delay: number = 500
): MutationObserver {
  let timerId: number | null = null;

  const debouncedCallback = () => {
    if (timerId) {
      clearTimeout(timerId);
    }
    timerId = window.setTimeout(() => {
      callback();
      timerId = null;
    }, delay);
  };

  return new MutationObserver(debouncedCallback);
}

/**
 * TriggerObserver class with lifecycle management
 * Automatically pauses when tab is hidden for performance
 */
export class TriggerObserver {
  private observer: MutationObserver | null = null;
  private callback: ObserverCallback;
  private debounceMs: number;
  private isPaused: boolean = false;
  private visibilityHandler: (() => void) | null = null;

  constructor(callback: ObserverCallback, debounceMs: number = 500) {
    this.callback = callback;
    this.debounceMs = debounceMs;
  }

  /**
   * Start observing DOM changes
   * Automatically integrates with Page Visibility API
   */
  start(): void {
    if (this.observer) return; // Already observing

    this.observer = createDebouncedObserver(this.callback, this.debounceMs);

    // Only observe if page is visible
    if (!document.hidden) {
      this.observe();
    }

    // Set up visibility change listener
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // Initial check
    this.callback();
  }

  /**
   * Stop observing and clean up
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    this.isPaused = false;
  }

  /**
   * Pause observation (called when tab hidden)
   */
  private pause(): void {
    if (this.observer && !this.isPaused) {
      this.observer.disconnect();
      this.isPaused = true;
    }
  }

  /**
   * Resume observation (called when tab visible)
   */
  private resume(): void {
    if (this.observer && this.isPaused) {
      this.observe();
      this.isPaused = false;
      // Re-check after resume
      this.callback();
    }
  }

  /**
   * Internal: connect observer to DOM
   */
  private observe(): void {
    if (!this.observer) return;

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      // Only observe attributes that affect visibility/presence
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'disabled']
    });
  }
}
