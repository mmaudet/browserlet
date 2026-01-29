/**
 * Content script trigger initialization
 * Sets up ContextDetector and message communication with background
 */

import type { TriggerConfig, ContextState } from '../../../utils/triggers/types';
import { ContextDetector } from './contextDetector';

let detector: ContextDetector | null = null;
let isInitialized = false;

/**
 * Initialize trigger system in content script
 * Requests triggers from background and starts monitoring
 */
export async function initializeTriggers(): Promise<void> {
  if (isInitialized) return;
  isInitialized = true;

  // Create detector
  detector = new ContextDetector();

  // Set up context change handler - send to background
  detector.onContextChange(async (state: ContextState) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'CONTEXT_MATCH',
        payload: state
      });
    } catch (error) {
      // Background might not be ready, ignore
    }
  });

  // Request triggers from background
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_TRIGGERS'
    });

    if (response.success && response.data) {
      const triggers = response.data as TriggerConfig[];
      detector.setTriggers(triggers);
      detector.startMonitoring();
      console.log('[Browserlet] Trigger monitoring started with', triggers.length, 'triggers');
    }
  } catch (error) {
    console.warn('[Browserlet] Failed to load triggers:', error);
  }
}

/**
 * Update triggers (called when triggers change)
 */
export function updateTriggers(triggers: TriggerConfig[]): void {
  if (detector) {
    detector.setTriggers(triggers);
    detector.forceEvaluate();
  }
}

/**
 * Stop trigger monitoring (for cleanup)
 */
export function stopTriggers(): void {
  if (detector) {
    detector.stopMonitoring();
    detector = null;
  }
  isInitialized = false;
}

/**
 * Handle messages from background about trigger updates
 */
export function handleTriggerMessage(message: { type: string; payload?: unknown }): void {
  switch (message.type) {
    case 'TRIGGERS_UPDATED': {
      const triggers = message.payload as TriggerConfig[];
      updateTriggers(triggers);
      break;
    }
    case 'STOP_TRIGGERS':
      stopTriggers();
      break;
  }
}
