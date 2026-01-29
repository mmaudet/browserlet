/**
 * Context detector for trigger condition evaluation
 * Combines URL pattern matching with element presence detection
 */

import type { TriggerCondition, TriggerConfig, ContextState } from '../../../utils/triggers/types';
import { resolveElement } from '../playback/semanticResolver';
import { isElementVisible } from '../../../utils/hints/dom';
import { matchesUrlPattern } from './urlMatcher';
import { TriggerObserver } from './observer';

export type ContextChangeCallback = (state: ContextState) => void;

/**
 * ContextDetector monitors page state for trigger conditions
 * Notifies listeners when context matches or stops matching
 */
export class ContextDetector {
  private triggers: TriggerConfig[] = [];
  private observer: TriggerObserver | null = null;
  private listeners: Set<ContextChangeCallback> = new Set();
  private lastState: ContextState | null = null;
  private isMonitoring: boolean = false;

  constructor(triggers: TriggerConfig[] = []) {
    this.triggers = triggers;
  }

  /**
   * Update the triggers to monitor
   */
  setTriggers(triggers: TriggerConfig[]): void {
    this.triggers = triggers.filter(t => t.enabled);

    // Re-evaluate if already monitoring
    if (this.isMonitoring) {
      this.evaluateContext();
    }
  }

  /**
   * Start monitoring page context
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    // Create observer for element-based conditions
    const hasElementConditions = this.triggers.some(t =>
      t.conditions.some(c => c.element_present || c.element_absent)
    );

    if (hasElementConditions) {
      this.observer = new TriggerObserver(() => this.evaluateContext());
      this.observer.start();
    } else {
      // URL-only triggers - just evaluate once
      this.evaluateContext();
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    this.isMonitoring = false;

    if (this.observer) {
      this.observer.stop();
      this.observer = null;
    }
  }

  /**
   * Register context change callback
   */
  onContextChange(callback: ContextChangeCallback): void {
    this.listeners.add(callback);
  }

  /**
   * Remove context change callback
   */
  offContextChange(callback: ContextChangeCallback): void {
    this.listeners.delete(callback);
  }

  /**
   * Evaluate all trigger conditions against current context
   */
  private evaluateContext(): void {
    const currentUrl = window.location.href;
    const matchedTriggers: TriggerConfig[] = [];

    for (const trigger of this.triggers) {
      if (this.checkTrigger(trigger, currentUrl)) {
        matchedTriggers.push(trigger);
      }
    }

    const matches = matchedTriggers.length > 0;
    const state: ContextState = {
      matches,
      reason: matches ? 'conditions_met' : 'no_match',
      matchedTriggers: matches ? matchedTriggers : undefined,
      url: currentUrl
    };

    // Only notify if state changed
    if (!this.statesEqual(state, this.lastState)) {
      this.lastState = state;
      this.notifyListeners(state);
    }
  }

  /**
   * Check if a single trigger's conditions are met
   */
  private checkTrigger(trigger: TriggerConfig, currentUrl: string): boolean {
    // All conditions must match (AND logic)
    return trigger.conditions.every(condition =>
      this.checkCondition(condition, currentUrl)
    );
  }

  /**
   * Check a single condition
   */
  private checkCondition(condition: TriggerCondition, currentUrl: string): boolean {
    // Check URL pattern (if specified)
    if (condition.url_pattern) {
      if (!matchesUrlPattern(currentUrl, condition.url_pattern)) {
        return false;
      }
    }

    // Check element presence (if specified)
    if (condition.element_present) {
      const result = resolveElement(condition.element_present.hints);
      if (!result.element || !isElementVisible(result.element)) {
        return false;
      }
    }

    // Check element absence (if specified)
    if (condition.element_absent) {
      const result = resolveElement(condition.element_absent.hints);
      if (result.element && isElementVisible(result.element)) {
        return false; // Element found but should be absent
      }
    }

    return true; // All specified conditions met
  }

  /**
   * Compare two context states for equality
   */
  private statesEqual(a: ContextState, b: ContextState | null): boolean {
    if (!b) return false;
    if (a.matches !== b.matches) return false;
    if (a.url !== b.url) return false;

    // Compare matched triggers by ID
    const aIds = a.matchedTriggers?.map(t => t.id).sort() ?? [];
    const bIds = b.matchedTriggers?.map(t => t.id).sort() ?? [];
    return aIds.join(',') === bIds.join(',');
  }

  /**
   * Notify all listeners of context change
   */
  private notifyListeners(state: ContextState): void {
    this.listeners.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        console.error('[Browserlet] Context listener error:', error);
      }
    });
  }

  /**
   * Force re-evaluation (useful after trigger update)
   */
  forceEvaluate(): void {
    this.lastState = null; // Reset to force notification
    this.evaluateContext();
  }

  /**
   * Get current context state without triggering callbacks
   */
  getCurrentState(): ContextState | null {
    return this.lastState;
  }
}
