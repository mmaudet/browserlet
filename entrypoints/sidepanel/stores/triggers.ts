import { signal, computed } from '@preact/signals';
import type { TriggerConfig, ContextState } from '../../../utils/triggers/types';
import { getAllTriggers, getTriggers } from '../../../utils/storage/triggers';

// Reactive state for all triggers
export const triggersState = signal<TriggerConfig[]>([]);

// Reactive state for currently suggested scripts (matched by context)
export const suggestedScriptIds = signal<string[]>([]);

// Reactive state for current context
export const currentContext = signal<ContextState | null>(null);

// Loading state
export const isLoadingTriggers = signal(false);

// Derived: triggers for a specific script
export function getTriggersForScript(scriptId: string): TriggerConfig[] {
  return triggersState.value.filter(t => t.scriptId === scriptId);
}

// Derived: active (enabled) triggers only
export const activeTriggers = computed(() =>
  triggersState.value.filter(t => t.enabled)
);

// Load all triggers from storage
export async function loadTriggers(): Promise<void> {
  isLoadingTriggers.value = true;
  try {
    triggersState.value = await getAllTriggers();
    // Also load suggestions for current tab
    await loadSuggestionsForCurrentTab();
  } finally {
    isLoadingTriggers.value = false;
  }
}

// Load suggestions for current tab from session storage
export async function loadSuggestionsForCurrentTab(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (tabId) {
      const key = `suggested_scripts_${tabId}`;
      const data = await chrome.storage.session.get(key);
      const scriptIds = (data[key] as string[] | undefined) ?? [];
      console.log('[Browserlet] Loaded suggestions for tab', tabId, ':', scriptIds);
      suggestedScriptIds.value = scriptIds;
    }
  } catch (error) {
    console.warn('[Browserlet] Failed to load suggestions:', error);
  }
}

// Load triggers for specific script
export async function loadTriggersForScript(scriptId: string): Promise<void> {
  isLoadingTriggers.value = true;
  try {
    const scriptTriggers = await getTriggers(scriptId);
    // Merge into state
    const others = triggersState.value.filter(t => t.scriptId !== scriptId);
    triggersState.value = [...others, ...scriptTriggers];
  } finally {
    isLoadingTriggers.value = false;
  }
}

// Update suggested scripts from context match
export function setSuggestedScripts(scriptIds: string[]): void {
  suggestedScriptIds.value = scriptIds;
}

// Clear suggestions
export function clearSuggestions(): void {
  suggestedScriptIds.value = [];
}

// Update current context
export function setCurrentContext(context: ContextState | null): void {
  currentContext.value = context;
}

// Listen for storage changes (sync across contexts)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.browserlet_triggers) {
    triggersState.value = (changes.browserlet_triggers.newValue as TriggerConfig[] | undefined) ?? [];
  }
  // Listen for session storage changes (suggestions)
  if (area === 'session') {
    // Check if any suggested_scripts_ key changed
    for (const key of Object.keys(changes)) {
      if (key.startsWith('suggested_scripts_')) {
        // Reload suggestions for current tab
        loadSuggestionsForCurrentTab();
        break;
      }
    }
  }
});

// Listen for tab changes to update suggestions
chrome.tabs.onActivated.addListener(() => {
  loadSuggestionsForCurrentTab();
});
