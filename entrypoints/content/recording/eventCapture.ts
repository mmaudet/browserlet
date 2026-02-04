import { CapturedAction, ActionType } from './types';
import { generateHints } from './hintGenerator';

export type EventCallback = (action: CapturedAction) => void;

/**
 * Captures DOM events (click, input, submit) using event delegation.
 * Uses capture phase to intercept events before they reach target handlers.
 */
export class EventCapture {
  private isActive = false;
  private callback: EventCallback | null = null;
  private cleanupFns: (() => void)[] = [];

  // Debounce input events to avoid capturing every keystroke
  private inputDebounceMap = new Map<Element, number>();
  private pendingInputs = new Map<Element, () => void>(); // Store pending capture functions
  private readonly INPUT_DEBOUNCE_MS = 1500; // Increased from 500ms to reduce duplicates

  /**
   * Start capturing events.
   * @param callback - Called when an action is captured
   */
  start(callback: EventCallback): void {
    if (this.isActive) return;

    this.isActive = true;
    this.callback = callback;

    // Use capture phase to intercept events early
    const clickHandler = this.handleClick.bind(this);
    const inputHandler = this.handleInput.bind(this);
    const submitHandler = this.handleSubmit.bind(this);

    document.addEventListener('click', clickHandler, { capture: true, passive: true });
    document.addEventListener('input', inputHandler, { capture: true, passive: true });
    document.addEventListener('submit', submitHandler, { capture: true });

    // Store cleanup functions
    this.cleanupFns.push(
      () => document.removeEventListener('click', clickHandler, { capture: true }),
      () => document.removeEventListener('input', inputHandler, { capture: true }),
      () => document.removeEventListener('submit', submitHandler, { capture: true })
    );
  }

  /**
   * Stop capturing events and clean up.
   */
  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;

    // Clear debounce timers first
    this.inputDebounceMap.forEach(timer => clearTimeout(timer));
    this.inputDebounceMap.clear();

    // Flush any pending input captures before stopping
    // This ensures inputs typed just before stop are not lost
    this.pendingInputs.forEach(captureInput => captureInput());
    this.pendingInputs.clear();

    this.callback = null;

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

  private handleClick(event: MouseEvent): void {
    if (!this.isActive || !this.callback) return;

    const target = event.target as Element;
    if (!target || !this.isInteractiveElement(target)) return;

    // Skip our own overlay elements
    if (target.hasAttribute('data-browserlet-overlay')) return;

    const action = this.createAction('click', target);
    this.callback(action);
  }

  private handleInput(event: Event): void {
    if (!this.isActive || !this.callback) return;

    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target) return;

    // Debounce input events
    const existingTimer = this.inputDebounceMap.get(target);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Store the capture function for potential flush on stop
    const captureInput = (): void => {
      if (!this.callback) return;

      const action = this.createAction('input', target, {
        value: this.getSanitizedValue(target)
      });
      this.callback(action);

      this.inputDebounceMap.delete(target);
      this.pendingInputs.delete(target);
    };

    this.pendingInputs.set(target, captureInput);

    const timer = window.setTimeout(() => {
      if (!this.isActive) return;
      captureInput();
    }, this.INPUT_DEBOUNCE_MS);

    this.inputDebounceMap.set(target, timer);
  }

  private handleSubmit(event: Event): void {
    if (!this.isActive || !this.callback) return;

    const form = event.target as HTMLFormElement;
    if (!form) return;

    const action = this.createAction('submit', form);
    this.callback(action);
  }

  private createAction(
    type: ActionType,
    element: Element,
    extra: Partial<CapturedAction> = {}
  ): CapturedAction {
    const action: CapturedAction = {
      type,
      timestamp: Date.now(),
      url: window.location.href,
      hints: generateHints(element),
      isIframe: window !== window.top,
      frameId: this.getFrameId(),
      ...extra
    };

    // Capture fallback selector for links (href is very stable)
    if (element.tagName.toLowerCase() === 'a') {
      const href = element.getAttribute('href');
      if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
        // Use href attribute selector as fallback
        action.fallbackSelector = `a[href="${href}"]`;
      }
    }

    // Capture fallback selector for elements with stable data-* attributes
    const testId = element.getAttribute('data-testid') || element.getAttribute('data-test-id');
    if (testId && !action.fallbackSelector) {
      action.fallbackSelector = `[data-testid="${testId}"], [data-test-id="${testId}"]`;
    }

    return action;
  }

  /**
   * Check if an element is worth capturing (interactive elements).
   */
  private isInteractiveElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'label'];

    if (interactiveTags.includes(tagName)) return true;

    // Check for role attribute
    const role = element.getAttribute('role');
    if (role && ['button', 'link', 'checkbox', 'radio', 'menuitem', 'tab'].includes(role)) {
      return true;
    }

    // Check for click handlers or tabindex
    if (element.hasAttribute('onclick') || element.hasAttribute('tabindex')) {
      return true;
    }

    // Check for cursor: pointer style (common for custom clickable elements)
    const style = window.getComputedStyle(element);
    if (style.cursor === 'pointer') return true;

    return false;
  }

  /**
   * Get sanitized input value (mask passwords).
   */
  private getSanitizedValue(input: HTMLInputElement | HTMLTextAreaElement): string {
    // Don't capture password values
    if (input instanceof HTMLInputElement && input.type === 'password') {
      return '[MASKED]';
    }
    return input.value;
  }

  /**
   * Generate a unique frame identifier.
   */
  private getFrameId(): string | undefined {
    if (window === window.top) return undefined;
    // Use URL + timestamp for iframe identification
    return `${window.location.href}-${performance.now()}`;
  }
}
