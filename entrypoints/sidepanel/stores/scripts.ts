import { signal, computed } from '@preact/signals';
import { storage } from '../../../utils/storage/browserCompat';
import type { Script } from '../../../utils/types';
import { getScripts } from '../../../utils/storage/scripts';

// Reactive state
export const scriptsState = signal<Script[]>([]);
export const searchTerm = signal('');
export const isLoading = signal(false);
export const selectedScriptId = signal<string | null>(null);

// Derived state: filtered scripts
export const filteredScripts = computed(() => {
  const term = searchTerm.value.trim().toLowerCase();
  if (!term) return scriptsState.value;

  return scriptsState.value.filter(s =>
    s.name.toLowerCase().includes(term) ||
    s.description?.toLowerCase().includes(term) ||
    s.target_app?.toLowerCase().includes(term) ||
    s.tags?.some(t => t.toLowerCase().includes(term))
  );
});

// Selected script derived state
export const selectedScript = computed(() => {
  const id = selectedScriptId.value;
  if (!id) return null;
  return scriptsState.value.find(s => s.id === id) || null;
});

// Load scripts from storage
export async function loadScripts(): Promise<void> {
  isLoading.value = true;
  try {
    scriptsState.value = await getScripts();
  } finally {
    isLoading.value = false;
  }
}

// Listen for storage changes (sync across contexts)
storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.browserlet_scripts) {
    scriptsState.value = (changes.browserlet_scripts.newValue as Script[] | undefined) ?? [];
  }
});

// Select a script
export function selectScript(id: string | null): void {
  selectedScriptId.value = id;
}

// Update a script in local state (after save)
export function updateScriptInState(script: Script): void {
  const scripts = scriptsState.value;
  const index = scripts.findIndex(s => s.id === script.id);
  if (index >= 0) {
    scriptsState.value = [...scripts.slice(0, index), script, ...scripts.slice(index + 1)];
  } else {
    scriptsState.value = [...scripts, script];
  }
}
