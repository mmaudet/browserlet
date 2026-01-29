import { CapturedAction } from './types';

export type NavigationCallback = (action: CapturedAction) => void;

/**
 * Captures navigation events including:
 * - Traditional page loads (beforeunload)
 * - SPA navigation (History API: pushState, replaceState)
 * - Back/forward navigation (popstate)
 */
export class NavigationCapture {
  private isActive = false;
  private callback: NavigationCallback | null = null;
  private cleanupFns: (() => void)[] = [];

  // Store original methods for monkey-patching
  private originalPushState: typeof history.pushState | null = null;
  private originalReplaceState: typeof history.replaceState | null = null;

  /**
   * Start capturing navigation events.
   * @param callback - Called when a navigation is captured
   */
  start(callback: NavigationCallback): void {
    if (this.isActive) return;

    this.isActive = true;
    this.callback = callback;

    // 1. Traditional navigation
    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      this.captureNavigation('Traditional navigation', window.location.href);
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);
    this.cleanupFns.push(() => window.removeEventListener('beforeunload', beforeUnloadHandler));

    // 2. SPA navigation - History API monkey-patching
    this.patchHistoryAPI();

    // 3. Back/forward navigation
    const popstateHandler = () => {
      this.captureNavigation('Back/forward navigation', window.location.href);
    };
    window.addEventListener('popstate', popstateHandler);
    this.cleanupFns.push(() => window.removeEventListener('popstate', popstateHandler));

    // 4. Hash changes (for hash-based routing)
    const hashChangeHandler = () => {
      this.captureNavigation('Hash change', window.location.href);
    };
    window.addEventListener('hashchange', hashChangeHandler);
    this.cleanupFns.push(() => window.removeEventListener('hashchange', hashChangeHandler));
  }

  /**
   * Stop capturing navigation events and restore original behavior.
   */
  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.callback = null;

    // Restore original History API methods
    this.restoreHistoryAPI();

    // Run all cleanup functions
    this.cleanupFns.forEach(fn => fn());
    this.cleanupFns = [];
  }

  /**
   * Check if capture is active.
   */
  get active(): boolean {
    return this.isActive;
  }

  /**
   * Monkey-patch history.pushState and history.replaceState.
   */
  private patchHistoryAPI(): void {
    this.originalPushState = history.pushState.bind(history);
    this.originalReplaceState = history.replaceState.bind(history);

    const self = this;

    history.pushState = function(state: unknown, unused: string, url?: string | URL | null) {
      const targetUrl = url ? new URL(url.toString(), window.location.href).href : window.location.href;
      self.captureNavigation('SPA navigation (pushState)', targetUrl);
      return self.originalPushState!(state, unused, url);
    };

    history.replaceState = function(state: unknown, unused: string, url?: string | URL | null) {
      const targetUrl = url ? new URL(url.toString(), window.location.href).href : window.location.href;
      self.captureNavigation('SPA navigation (replaceState)', targetUrl);
      return self.originalReplaceState!(state, unused, url);
    };

    this.cleanupFns.push(() => this.restoreHistoryAPI());
  }

  /**
   * Restore original History API methods.
   */
  private restoreHistoryAPI(): void {
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      this.originalPushState = null;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      this.originalReplaceState = null;
    }
  }

  /**
   * Create and emit a navigation action.
   */
  private captureNavigation(description: string, targetUrl: string): void {
    if (!this.isActive || !this.callback) return;

    const action: CapturedAction = {
      type: 'navigate',
      timestamp: Date.now(),
      url: window.location.href,
      targetUrl,
      hints: [], // Navigation actions don't have element hints
      isIframe: window !== window.top,
    };

    this.callback(action);
  }
}
