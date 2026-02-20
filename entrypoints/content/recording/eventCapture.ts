import { CapturedAction, ActionType } from './types';
import { generateHints, detectSPAContext } from './hintGenerator';

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

    // Flush pending inputs on page unload to avoid losing debounced input
    // (e.g., user types password then page navigates before 1500ms debounce fires)
    const beforeUnloadHandler = () => {
      this.flushPendingInputs();
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);

    // Store cleanup functions
    this.cleanupFns.push(
      () => document.removeEventListener('click', clickHandler, { capture: true }),
      () => document.removeEventListener('input', inputHandler, { capture: true }),
      () => document.removeEventListener('submit', submitHandler, { capture: true }),
      () => window.removeEventListener('beforeunload', beforeUnloadHandler)
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

    // Flush pending inputs to ensure correct ordering
    // (e.g., if user types in a field then clicks a button)
    this.flushPendingInputs();

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

    // IMPORTANT: Flush any pending input captures BEFORE capturing the submit
    // This ensures inputs typed just before submit are captured in the correct order
    this.flushPendingInputs();

    // Find the submit button that triggered this event
    // This is more useful than capturing the form itself
    const submitButton = this.findSubmitButton(form);

    if (submitButton) {
      // Capture the submit button, not the form
      const action = this.createAction('submit', submitButton);
      this.callback(action);
    } else {
      // Fallback to form if no submit button found
      const action = this.createAction('submit', form);
      this.callback(action);
    }
  }

  /**
   * Flush all pending debounced input captures immediately.
   * Used before submit to ensure correct action ordering.
   */
  private flushPendingInputs(): void {
    // Clear all debounce timers
    this.inputDebounceMap.forEach(timer => clearTimeout(timer));
    this.inputDebounceMap.clear();

    // Execute all pending input captures
    this.pendingInputs.forEach(captureInput => captureInput());
    this.pendingInputs.clear();
  }

  /**
   * Scan the DOM for pre-filled password fields and emit input actions for them.
   * Only emits for elements not already tracked by the debounce map (avoids duplicates).
   * Called after recording resumes to catch passwords typed during content script reinjection.
   */
  capturePreFilledPasswords(): void {
    if (!this.isActive || !this.callback) return;

    const passwordInputs = document.querySelectorAll('input[type="password"]');
    for (const el of passwordInputs) {
      const input = el as HTMLInputElement;
      if (!input.value) continue;

      // Skip if we're already tracking this element (user is actively typing)
      if (this.pendingInputs.has(input) || this.inputDebounceMap.has(input)) continue;

      const action = this.createAction('input', input, {
        value: this.getSanitizedValue(input)
      });
      this.callback(action);
    }
  }

  /**
   * Find the submit button that likely triggered a form submission.
   * Checks for focused element first, then looks for submit buttons in the form.
   */
  private findSubmitButton(form: HTMLFormElement): Element | null {
    // Check if the currently focused element is a submit button in this form
    const activeElement = document.activeElement;
    if (activeElement && form.contains(activeElement)) {
      if (activeElement instanceof HTMLButtonElement && activeElement.type === 'submit') {
        return activeElement;
      }
      if (activeElement instanceof HTMLInputElement && activeElement.type === 'submit') {
        return activeElement;
      }
    }

    // Find the first submit button in the form
    const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitButton) {
      return submitButton;
    }

    // Look for buttons without explicit type (default is submit)
    const defaultButton = form.querySelector('button:not([type])');
    if (defaultButton) {
      return defaultButton;
    }

    return null;
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

    // Detect SPA framework context (React/Vue/Angular)
    const spaCtx = detectSPAContext(element);
    if (spaCtx) {
      action.spa_context = spaCtx;
    }

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
   * Excludes form elements (handled separately by submit event).
   */
  private isInteractiveElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();

    // Explicitly exclude form elements - clicks on forms are meaningless
    // Form submission is handled by the submit event handler
    if (tagName === 'form') return false;

    const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'label'];

    if (interactiveTags.includes(tagName)) return true;

    // Check for role attribute (exclude 'form' role as well)
    const role = element.getAttribute('role');
    if (role === 'form') return false;
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
