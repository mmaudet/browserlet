import van from 'vanjs-core';
import type { Script } from '../../../utils/types';
import { getScripts } from '../../../utils/storage/scripts';

// Reactive state
export const scriptsState = van.state<Script[]>([]);
export const searchTerm = van.state('');
export const isLoading = van.state(false);
export const selectedScriptId = van.state<string | null>(null);

// Derived state: filtered scripts
export const filteredScripts = van.derive(() => {
  const term = searchTerm.val.trim().toLowerCase();
  if (!term) return scriptsState.val;

  return scriptsState.val.filter(s =>
    s.name.toLowerCase().includes(term) ||
    s.description?.toLowerCase().includes(term) ||
    s.target_app?.toLowerCase().includes(term) ||
    s.tags?.some(t => t.toLowerCase().includes(term))
  );
});

// Selected script derived state
export const selectedScript = van.derive(() => {
  const id = selectedScriptId.val;
  if (!id) return null;
  return scriptsState.val.find(s => s.id === id) || null;
});

// Load scripts from storage
export async function loadScripts(): Promise<void> {
  isLoading.val = true;
  try {
    scriptsState.val = await getScripts();
  } finally {
    isLoading.val = false;
  }
}

// Listen for storage changes (sync across contexts)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.browserlet_scripts) {
    scriptsState.val = (changes.browserlet_scripts.newValue as Script[] | undefined) ?? [];
  }
});

// Select a script
export function selectScript(id: string | null): void {
  selectedScriptId.val = id;
}

// Update a script in local state (after save)
export function updateScriptInState(script: Script): void {
  const scripts = scriptsState.val;
  const index = scripts.findIndex(s => s.id === script.id);
  if (index >= 0) {
    scriptsState.val = [...scripts.slice(0, index), script, ...scripts.slice(index + 1)];
  } else {
    scriptsState.val = [...scripts, script];
  }
}
