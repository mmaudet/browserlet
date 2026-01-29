import { CapturedAction, RecordingState, RecordingSession } from './types';
import { EventCapture } from './eventCapture';
import { NavigationCapture } from './navigationCapture';
import { HighlightOverlay, RecordingIndicator } from './visualFeedback';
import { generateHints } from './hintGenerator';

export type RecordingEventHandler = (event: {
  type: 'state_changed' | 'action_captured';
  state?: RecordingState;
  action?: CapturedAction;
  session?: RecordingSession;
}) => void;

/**
 * Central orchestrator for recording functionality.
 * Coordinates event capture, navigation capture, visual feedback, and state management.
 */
export class RecordingManager {
  private state: RecordingState = 'idle';
  private session: RecordingSession | null = null;

  private eventCapture: EventCapture;
  private navigationCapture: NavigationCapture;
  private overlay: HighlightOverlay;
  private indicator: RecordingIndicator;

  private eventHandler: RecordingEventHandler | null = null;
  private hoverCleanup: (() => void) | null = null;

  constructor() {
    this.eventCapture = new EventCapture();
    this.navigationCapture = new NavigationCapture();
    this.overlay = new HighlightOverlay();
    this.indicator = new RecordingIndicator();
  }

  /**
   * Set event handler for recording events.
   */
  onEvent(handler: RecordingEventHandler): void {
    this.eventHandler = handler;
  }

  /**
   * Get current recording state.
   */
  getState(): RecordingState {
    return this.state;
  }

  /**
   * Get current recording session (if recording).
   */
  getSession(): RecordingSession | null {
    return this.session;
  }

  /**
   * Get captured actions from current session.
   */
  getActions(): CapturedAction[] {
    return this.session?.actions ?? [];
  }

  /**
   * Start recording user interactions.
   */
  start(): void {
    if (this.state === 'recording') return;

    // Create new session
    this.session = {
      id: this.generateSessionId(),
      startTime: Date.now(),
      actions: [],
      startUrl: window.location.href
    };

    this.state = 'recording';

    // Start visual feedback
    this.indicator.show();
    this.setupHoverHighlight();

    // Start capture modules
    this.eventCapture.start((action) => this.handleAction(action));
    this.navigationCapture.start((action) => this.handleAction(action));

    this.emit('state_changed');
  }

  /**
   * Stop recording and return captured session.
   */
  stop(): RecordingSession | null {
    if (this.state === 'idle') return null;

    // Stop capture modules
    this.eventCapture.stop();
    this.navigationCapture.stop();

    // Stop visual feedback
    this.indicator.hide();
    this.overlay.hide();
    this.cleanupHoverHighlight();

    // Finalize session
    if (this.session) {
      this.session.endTime = Date.now();
    }

    const result = this.session;
    this.session = null;
    this.state = 'idle';

    this.emit('state_changed');
    return result;
  }

  /**
   * Pause recording (keep session, stop capture).
   */
  pause(): void {
    if (this.state !== 'recording') return;

    this.eventCapture.stop();
    this.navigationCapture.stop();
    this.cleanupHoverHighlight();

    this.state = 'paused';
    this.emit('state_changed');
  }

  /**
   * Resume recording from paused state.
   */
  resume(): void {
    if (this.state !== 'paused') return;

    this.setupHoverHighlight();
    this.eventCapture.start((action) => this.handleAction(action));
    this.navigationCapture.start((action) => this.handleAction(action));

    this.state = 'recording';
    this.emit('state_changed');
  }

  /**
   * Destroy the manager and clean up all resources.
   */
  destroy(): void {
    this.stop();
    this.eventHandler = null;
  }

  /**
   * Handle a captured action.
   */
  private handleAction(action: CapturedAction): void {
    if (this.state !== 'recording' || !this.session) return;

    this.session.actions.push(action);

    // Show captured feedback briefly
    // (We can't highlight navigation actions as they have no element)
    if (action.type !== 'navigate') {
      // The actual element is not stored in action, so we rely on mouseover
      // highlighting. The "captured" state flash happens on click.
    }

    this.emit('action_captured', action);
  }

  /**
   * Set up hover highlighting during recording.
   */
  private setupHoverHighlight(): void {
    const mousemoveHandler = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target) return;

      // Skip our own elements
      if (target.hasAttribute('data-browserlet-overlay') ||
          target.hasAttribute('data-browserlet-indicator')) {
        return;
      }

      // Only highlight interactive elements
      if (this.isInteractiveElement(target)) {
        this.overlay.show(target, 'hover');
      } else {
        this.overlay.hide();
      }
    };

    const mousedownHandler = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target) return;
      if (target.hasAttribute('data-browserlet-overlay')) return;

      // Flash captured state
      if (this.isInteractiveElement(target)) {
        this.overlay.show(target, 'captured');
        // Return to hover state after brief flash
        setTimeout(() => {
          if (this.state === 'recording') {
            this.overlay.setState('hover');
          }
        }, 200);
      }
    };

    const mouseoutHandler = () => {
      this.overlay.hide();
    };

    document.addEventListener('mousemove', mousemoveHandler, { passive: true });
    document.addEventListener('mousedown', mousedownHandler, { passive: true });
    document.addEventListener('mouseout', mouseoutHandler, { passive: true });

    this.hoverCleanup = () => {
      document.removeEventListener('mousemove', mousemoveHandler);
      document.removeEventListener('mousedown', mousedownHandler);
      document.removeEventListener('mouseout', mouseoutHandler);
    };
  }

  /**
   * Clean up hover highlighting.
   */
  private cleanupHoverHighlight(): void {
    if (this.hoverCleanup) {
      this.hoverCleanup();
      this.hoverCleanup = null;
    }
    this.overlay.hide();
  }

  /**
   * Check if element is interactive (same logic as EventCapture).
   */
  private isInteractiveElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'label'];

    if (interactiveTags.includes(tagName)) return true;

    const role = element.getAttribute('role');
    if (role && ['button', 'link', 'checkbox', 'radio', 'menuitem', 'tab'].includes(role)) {
      return true;
    }

    if (element.hasAttribute('onclick') || element.hasAttribute('tabindex')) {
      return true;
    }

    const style = window.getComputedStyle(element);
    if (style.cursor === 'pointer') return true;

    return false;
  }

  /**
   * Emit event to handler.
   */
  private emit(type: 'state_changed' | 'action_captured', action?: CapturedAction): void {
    if (!this.eventHandler) return;

    this.eventHandler({
      type,
      state: this.state,
      action,
      session: this.session ?? undefined
    });
  }

  /**
   * Generate a unique session ID.
   */
  private generateSessionId(): string {
    return `rec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Re-export types for convenience
export type { CapturedAction, RecordingState, RecordingSession, SemanticHint, HintType } from './types';
export { generateHints } from './hintGenerator';
