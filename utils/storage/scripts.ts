import { storage } from './browserCompat';
import type { Script } from '../types';

const SCRIPTS_KEY = 'browserlet_scripts';

// Get all scripts
export async function getScripts(): Promise<Script[]> {
  const result = await storage.local.get(SCRIPTS_KEY);
  return (result[SCRIPTS_KEY] as Script[] | undefined) ?? [];
}

// Get single script by ID
export async function getScript(id: string): Promise<Script | undefined> {
  const scripts = await getScripts();
  return scripts.find(s => s.id === id);
}

// Save script (create or update)
export async function saveScript(script: Omit<Script, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Script> {
  const scripts = await getScripts();
  const now = Date.now();

  if (script.id) {
    // Update existing
    const index = scripts.findIndex(s => s.id === script.id);
    const existing = scripts[index];
    if (index >= 0 && existing) {
      const updated: Script = {
        ...existing,
        ...script,
        id: script.id,
        createdAt: existing.createdAt,
        updatedAt: now
      };
      scripts[index] = updated;
      await storage.local.set({ [SCRIPTS_KEY]: scripts });
      return updated;
    }
  }

  // Create new
  const newScript: Script = {
    ...script,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now
  } as Script;

  await storage.local.set({ [SCRIPTS_KEY]: [...scripts, newScript] });
  return newScript;
}

// Delete script
export async function deleteScript(id: string): Promise<void> {
  const scripts = await getScripts();
  const filtered = scripts.filter(s => s.id !== id);
  await storage.local.set({ [SCRIPTS_KEY]: filtered });
}

// Search scripts (UI-02: by name, app, tag)
export async function searchScripts(query: string): Promise<Script[]> {
  const scripts = await getScripts();
  if (!query.trim()) return scripts;

  const q = query.toLowerCase();
  return scripts.filter(s =>
    s.name.toLowerCase().includes(q) ||
    s.description?.toLowerCase().includes(q) ||
    s.target_app?.toLowerCase().includes(q) ||
    s.tags?.some(t => t.toLowerCase().includes(q))
  );
}
