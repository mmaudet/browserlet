/**
 * Trigger evaluation engine for the service worker
 * Coordinates context matching and action dispatch
 */

import type { TriggerConfig, ContextState } from '../../../utils/triggers/types';
import type { Script } from '../../../utils/types';
import { getAllTriggers, getSiteOverride } from '../../../utils/storage/triggers';
import { getScripts } from '../../../utils/storage/scripts';
// Note: Chrome notifications with buttons don't work on macOS
// We use in-page notifications in content script instead

// Storage key for suggested scripts per tab
const SUGGESTED_KEY_PREFIX = 'suggested_scripts_';

// Cooldown tracking: scriptId -> { domain -> lastExecutionTime }
const cooldowns = new Map<string, Map<string, number>>();

// Default cooldown: 5 minutes
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * TriggerEngine coordinates trigger evaluation and action dispatch
 */
export class TriggerEngine {
  private triggers: TriggerConfig[] = [];
  private scripts: Map<string, Script> = new Map();
  private initialized: boolean = false;

  /**
   * Initialize the engine - load triggers and scripts
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.refresh();
    this.initialized = true;

    // Listen for storage changes to refresh triggers
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.browserlet_triggers || changes.browserlet_scripts) {
          this.refresh();
        }
      }
    });
  }

  /**
   * Refresh triggers and scripts from storage
   */
  async refresh(): Promise<void> {
    this.triggers = await getAllTriggers();
    const scripts = await getScripts();
    this.scripts = new Map(scripts.map(s => [s.id, s]));
  }

  /**
   * Handle context match from content script
   * Called when content script detects matching context
   */
  async handleContextMatch(
    tabId: number,
    context: ContextState
  ): Promise<void> {
    console.log('[Browserlet] handleContextMatch called, matches:', context.matches, 'triggers:', context.matchedTriggers?.length);

    if (!context.matches || !context.matchedTriggers) {
      // Context no longer matches - clear suggestions
      console.log('[Browserlet] No matches, clearing suggestions');
      await this.clearSuggestions(tabId);
      return;
    }

    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) {
      console.log('[Browserlet] No tab URL');
      return;
    }
    console.log('[Browserlet] Processing for tab:', tabId, 'url:', tab.url);

    // Group by mode
    const suggestTriggers: TriggerConfig[] = [];
    const autoExecuteTriggers: TriggerConfig[] = [];

    for (const trigger of context.matchedTriggers) {
      // Check site override
      const override = await getSiteOverride(trigger.scriptId, tab.url);
      if (override === false) {
        continue; // Disabled for this site
      }

      if (trigger.mode === 'suggest') {
        suggestTriggers.push(trigger);
      } else if (trigger.mode === 'auto_execute') {
        // Check cooldown
        if (!this.isOnCooldown(trigger, tab.url)) {
          autoExecuteTriggers.push(trigger);
        }
      }
    }

    // Handle suggest mode - update badge and store suggestions
    console.log('[Browserlet] suggestTriggers:', suggestTriggers.length, 'autoExecuteTriggers:', autoExecuteTriggers.length);
    if (suggestTriggers.length > 0) {
      await this.handleSuggestMode(tabId, suggestTriggers);
    } else {
      console.log('[Browserlet] No suggest triggers, clearing');
      await this.clearSuggestions(tabId);
    }

    // Handle auto-execute mode
    for (const trigger of autoExecuteTriggers) {
      await this.handleAutoExecute(tabId, trigger, tab.url);
    }
  }

  /**
   * Handle suggest mode - update badge and store
   */
  private async handleSuggestMode(
    tabId: number,
    triggers: TriggerConfig[]
  ): Promise<void> {
    const scriptIds = Array.from(new Set(triggers.map(t => t.scriptId)));
    console.log('[Browserlet] handleSuggestMode, scriptIds:', scriptIds, 'tabId:', tabId);

    // Update badge
    try {
      await chrome.action.setBadgeText({
        text: String(scriptIds.length),
        tabId
      });
      await chrome.action.setBadgeBackgroundColor({
        color: '#4285f4', // Blue
        tabId
      });
      console.log('[Browserlet] Badge set to:', scriptIds.length);
    } catch (error) {
      console.error('[Browserlet] Failed to set badge:', error);
    }

    // Store suggested scripts for sidepanel
    await chrome.storage.session.set({
      [`${SUGGESTED_KEY_PREFIX}${tabId}`]: scriptIds
    });
    console.log('[Browserlet] Stored suggestions for tab', tabId);
  }

  /**
   * Clear suggestions for tab
   */
  private async clearSuggestions(tabId: number): Promise<void> {
    await chrome.action.setBadgeText({ text: '', tabId });
    await chrome.storage.session.remove(`${SUGGESTED_KEY_PREFIX}${tabId}`);
  }

  /**
   * Handle auto-execute mode
   */
  private async handleAutoExecute(
    tabId: number,
    trigger: TriggerConfig,
    url: string
  ): Promise<void> {
    const script = this.scripts.get(trigger.scriptId);
    if (!script || !script.content) {
      console.warn('[Browserlet] Script not found for auto-execute:', trigger.scriptId);
      return;
    }

    // Set cooldown
    this.setCooldown(trigger, url);

    // Show in-page notification (works on all platforms including macOS)
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_AUTO_EXECUTE_NOTIFICATION',
        payload: {
          scriptName: script.name,
          scriptId: script.id,
          url
        }
      });
    } catch (error) {
      console.warn('[Browserlet] Failed to show notification:', error);
    }

    // Execute script
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'EXECUTE_SCRIPT',
        payload: { content: script.content }
      });
    } catch (error) {
      console.error('[Browserlet] Failed to send execute message:', error);
    }
  }

  /**
   * Check if trigger is on cooldown for domain
   */
  private isOnCooldown(trigger: TriggerConfig, url: string): boolean {
    const domain = new URL(url).hostname;
    const triggerCooldowns = cooldowns.get(trigger.id);
    if (!triggerCooldowns) return false;

    const lastExecution = triggerCooldowns.get(domain);
    if (!lastExecution) return false;

    const cooldownMs = trigger.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    return Date.now() - lastExecution < cooldownMs;
  }

  /**
   * Set cooldown after execution
   */
  private setCooldown(trigger: TriggerConfig, url: string): void {
    const domain = new URL(url).hostname;

    if (!cooldowns.has(trigger.id)) {
      cooldowns.set(trigger.id, new Map());
    }

    cooldowns.get(trigger.id)!.set(domain, Date.now());
  }

  /**
   * Get suggested script IDs for a tab
   */
  async getSuggestedScripts(tabId: number): Promise<string[]> {
    const key = `${SUGGESTED_KEY_PREFIX}${tabId}`;
    const data = await chrome.storage.session.get(key);
    return (data[key] as string[] | undefined) ?? [];
  }

  /**
   * Get active triggers for a script
   */
  getTriggersForScript(scriptId: string): TriggerConfig[] {
    return this.triggers.filter(t => t.scriptId === scriptId && t.enabled);
  }
}

// Singleton instance
let engineInstance: TriggerEngine | null = null;

/**
 * Get or create the trigger engine singleton
 */
export function getTriggerEngine(): TriggerEngine {
  if (!engineInstance) {
    engineInstance = new TriggerEngine();
  }
  return engineInstance;
}

/**
 * Handle context match message from content script
 */
export async function handleContextMatch(
  tabId: number,
  context: ContextState
): Promise<void> {
  const engine = getTriggerEngine();
  await engine.handleContextMatch(tabId, context);
}
