import { OVERLAY_STYLES, HEALING_OVERLAY_STYLES, RECORDING_INDICATOR_STYLES, CREDENTIAL_CAPTURE_STYLES, injectStyles } from './styles';

export type OverlayState = 'hover' | 'captured' | 'error';

/** Healing overlay states for self-healing selector workflow */
export type HealingOverlayState = 'proposed' | 'testing' | 'success' | 'failed';

/**
 * Non-intrusive overlay for highlighting DOM elements during recording.
 * Uses absolute positioning to avoid affecting page layout.
 */
export class HighlightOverlay {
  private overlay: HTMLDivElement | null = null;
  private currentElement: Element | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private scrollHandler: (() => void) | null = null;
  private healingStyleElement: HTMLStyleElement | null = null;
  private currentHealingState: HealingOverlayState | null = null;

  /**
   * Show highlight overlay on the given element.
   * @param element - The DOM element to highlight
   * @param state - Visual state (hover, captured, error)
   */
  show(element: Element, state: OverlayState = 'hover'): void {
    // Hide any existing overlay
    this.hide();

    this.currentElement = element;
    this.currentHealingState = null;

    // Create overlay element
    this.overlay = document.createElement('div');
    this.overlay.setAttribute('data-browserlet-overlay', 'true');
    this.overlay.style.cssText = OVERLAY_STYLES.base + OVERLAY_STYLES[state];

    // Position over element
    this.updatePosition();

    // Append to body
    document.body.appendChild(this.overlay);

    // Set up position tracking
    this.setupPositionTracking();
  }

  /**
   * Hide the overlay and clean up.
   */
  hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }

    if (this.healingStyleElement) {
      this.healingStyleElement.remove();
      this.healingStyleElement = null;
    }

    this.currentElement = null;
    this.currentHealingState = null;
    this.cleanupPositionTracking();
  }

  /**
   * Update overlay visual state without repositioning.
   */
  setState(state: OverlayState): void {
    if (this.overlay) {
      this.currentHealingState = null;
      this.overlay.style.cssText = OVERLAY_STYLES.base + OVERLAY_STYLES[state];
      this.updatePosition(); // Ensure position is correct
    }
  }

  /**
   * Set healing state for self-healing selector workflow
   * @param state - Healing visual state (proposed, testing, success, failed)
   */
  setHealingState(state: HealingOverlayState): void {
    if (!this.overlay) return;

    this.currentHealingState = state;

    // Inject keyframes for testing animation if needed
    if (state === 'testing' && !this.healingStyleElement) {
      this.healingStyleElement = injectStyles(
        HEALING_OVERLAY_STYLES.keyframes,
        'browserlet-healing-keyframes'
      );
    }

    this.overlay.style.cssText = OVERLAY_STYLES.base + HEALING_OVERLAY_STYLES[state];
    this.updatePosition();
  }

  /**
   * Show healing overlay on the given element.
   * @param element - The DOM element to highlight
   * @param state - Healing visual state (proposed, testing, success, failed)
   */
  showHealing(element: Element, state: HealingOverlayState = 'proposed'): void {
    // Hide any existing overlay
    this.hide();

    this.currentElement = element;
    this.currentHealingState = state;

    // Inject keyframes for testing animation if needed
    if (state === 'testing') {
      this.healingStyleElement = injectStyles(
        HEALING_OVERLAY_STYLES.keyframes,
        'browserlet-healing-keyframes'
      );
    }

    // Create overlay element
    this.overlay = document.createElement('div');
    this.overlay.setAttribute('data-browserlet-overlay', 'true');
    this.overlay.setAttribute('data-browserlet-healing', state);
    this.overlay.style.cssText = OVERLAY_STYLES.base + HEALING_OVERLAY_STYLES[state];

    // Position over element
    this.updatePosition();

    // Append to body
    document.body.appendChild(this.overlay);

    // Set up position tracking
    this.setupPositionTracking();
  }

  /**
   * Check if overlay is currently visible.
   */
  isVisible(): boolean {
    return this.overlay !== null;
  }

  /**
   * Get current healing state if in healing mode
   */
  getHealingState(): HealingOverlayState | null {
    return this.currentHealingState;
  }

  /**
   * Update overlay position to match current element bounds.
   */
  private updatePosition(): void {
    if (!this.overlay || !this.currentElement) return;

    const rect = this.currentElement.getBoundingClientRect();

    // Use scrollX/scrollY for absolute positioning relative to document
    this.overlay.style.top = `${rect.top + window.scrollY}px`;
    this.overlay.style.left = `${rect.left + window.scrollX}px`;
    this.overlay.style.width = `${rect.width}px`;
    this.overlay.style.height = `${rect.height}px`;
  }

  /**
   * Set up listeners to track element position changes.
   */
  private setupPositionTracking(): void {
    // Track scroll
    this.scrollHandler = () => this.updatePosition();
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.scrollHandler, { passive: true });

    // Track element size changes
    if (this.currentElement) {
      this.resizeObserver = new ResizeObserver(() => this.updatePosition());
      this.resizeObserver.observe(this.currentElement);
    }
  }

  /**
   * Clean up position tracking listeners.
   */
  private cleanupPositionTracking(): void {
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      window.removeEventListener('resize', this.scrollHandler);
      this.scrollHandler = null;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }
}

/**
 * Recording indicator that shows "REC" badge in corner of page.
 */
export class RecordingIndicator {
  private container: HTMLDivElement | null = null;
  private styleElement: HTMLStyleElement | null = null;

  /**
   * Show the recording indicator.
   */
  show(): void {
    if (this.container) return; // Already visible

    // Inject keyframes
    this.styleElement = injectStyles(
      RECORDING_INDICATOR_STYLES.keyframes,
      'browserlet-recording-keyframes'
    );

    // Create container
    this.container = document.createElement('div');
    this.container.setAttribute('data-browserlet-indicator', 'true');
    this.container.style.cssText = RECORDING_INDICATOR_STYLES.container;

    // Create pulsing dot
    const dot = document.createElement('div');
    dot.style.cssText = RECORDING_INDICATOR_STYLES.dot;

    // Create text
    const text = document.createElement('span');
    text.textContent = 'REC';

    this.container.appendChild(dot);
    this.container.appendChild(text);
    document.body.appendChild(this.container);
  }

  /**
   * Hide the recording indicator.
   */
  hide(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }

  /**
   * Check if indicator is currently visible.
   */
  isVisible(): boolean {
    return this.container !== null;
  }
}

/**
 * Credential capture indicator that shows "🔑 CAPTURE" badge in corner of page.
 * Uses purple color to distinguish from recording indicator.
 */
export class CredentialCaptureIndicator {
  private container: HTMLDivElement | null = null;
  private styleElement: HTMLStyleElement | null = null;

  /**
   * Show the credential capture indicator.
   */
  show(): void {
    if (this.container) return; // Already visible

    // Inject keyframes
    this.styleElement = injectStyles(
      CREDENTIAL_CAPTURE_STYLES.keyframes,
      'browserlet-capture-keyframes'
    );

    // Create container
    this.container = document.createElement('div');
    this.container.setAttribute('data-browserlet-capture-indicator', 'true');
    this.container.style.cssText = CREDENTIAL_CAPTURE_STYLES.container;

    // Create pulsing dot
    const dot = document.createElement('div');
    dot.style.cssText = CREDENTIAL_CAPTURE_STYLES.dot;

    // Create icon and text
    const text = document.createElement('span');
    text.textContent = '🔑 CAPTURE';

    this.container.appendChild(dot);
    this.container.appendChild(text);
    document.body.appendChild(this.container);
  }

  /**
   * Hide the credential capture indicator.
   */
  hide(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }

  /**
   * Check if indicator is currently visible.
   */
  isVisible(): boolean {
    return this.container !== null;
  }
}
