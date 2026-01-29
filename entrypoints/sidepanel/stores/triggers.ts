import van from 'vanjs-core';
import type { TriggerConfig, ContextState } from '../../../utils/triggers/types';
import { getAllTriggers, getTriggers } from '../../../utils/storage/triggers';

// Reactive state for all triggers
export const triggersState = van.state<TriggerConfig[]>([]);

// Reactive state for currently suggested scripts (matched by context)
export const suggestedScriptIds = van.state<string[]>([]);

// Reactive state for current context
export const currentContext = van.state<ContextState | null>(null);

// Loading state
export const isLoadingTriggers = van.state(false);

// Derived: triggers for a specific script
export function getTriggersForScript(scriptId: string): TriggerConfig[] {
  return triggersState.val.filter(t => t.scriptId === scriptId);
}

// Derived: active (enabled) triggers only
export const activeTriggers = van.derive(() =>
  triggersState.val.filter(t => t.enabled)
);

// Load all triggers from storage
export async function loadTriggers(): Promise<void> {
  isLoadingTriggers.val = true;
  try {
    triggersState.val = await getAllTriggers();
  } finally {
    isLoadingTriggers.val = false;
  }
}

// Load triggers for specific script
export async function loadTriggersForScript(scriptId: string): Promise<void> {
  isLoadingTriggers.val = true;
  try {
    const scriptTriggers = await getTriggers(scriptId);
    // Merge into state
    const others = triggersState.val.filter(t => t.scriptId !== scriptId);
    triggersState.val = [...others, ...scriptTriggers];
  } finally {
    isLoadingTriggers.val = false;
  }
}

// Update suggested scripts from context match
export function setSuggestedScripts(scriptIds: string[]): void {
  suggestedScriptIds.val = scriptIds;
}

// Clear suggestions
export function clearSuggestions(): void {
  suggestedScriptIds.val = [];
}

// Update current context
export function setCurrentContext(context: ContextState | null): void {
  currentContext.val = context;
}

// Listen for storage changes (sync across contexts)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.browserlet_triggers) {
    triggersState.val = (changes.browserlet_triggers.newValue as TriggerConfig[] | undefined) ?? [];
  }
});
