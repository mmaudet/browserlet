import { storage } from './browserCompat';
import type { TriggerConfig, SiteOverride } from '../triggers/types';

const TRIGGERS_KEY = 'browserlet_triggers';
const OVERRIDE_PREFIX = 'trigger_override_';

// Get all triggers for a script
export async function getTriggers(scriptId: string): Promise<TriggerConfig[]> {
  const data = await storage.local.get(TRIGGERS_KEY);
  const all = (data[TRIGGERS_KEY] as TriggerConfig[] | undefined) ?? [];
  return all.filter(t => t.scriptId === scriptId);
}

// Get all triggers (for engine)
export async function getAllTriggers(): Promise<TriggerConfig[]> {
  const data = await storage.local.get(TRIGGERS_KEY);
  return (data[TRIGGERS_KEY] as TriggerConfig[] | undefined) ?? [];
}

// Save trigger (create or update)
export async function saveTrigger(trigger: TriggerConfig): Promise<void> {
  const data = await storage.local.get(TRIGGERS_KEY);
  const triggers = (data[TRIGGERS_KEY] as TriggerConfig[] | undefined) ?? [];

  const index = triggers.findIndex(t => t.id === trigger.id);
  if (index >= 0) {
    triggers[index] = { ...trigger, updatedAt: Date.now() };
  } else {
    triggers.push({ ...trigger, createdAt: Date.now(), updatedAt: Date.now() });
  }

  await storage.local.set({ [TRIGGERS_KEY]: triggers });
}

// Delete trigger
export async function deleteTrigger(triggerId: string): Promise<void> {
  const data = await storage.local.get(TRIGGERS_KEY);
  const triggers = (data[TRIGGERS_KEY] as TriggerConfig[] | undefined) ?? [];
  const filtered = triggers.filter(t => t.id !== triggerId);
  await storage.local.set({ [TRIGGERS_KEY]: filtered });
}

// Delete all triggers for a script
export async function deleteTriggersForScript(scriptId: string): Promise<void> {
  const data = await storage.local.get(TRIGGERS_KEY);
  const triggers = (data[TRIGGERS_KEY] as TriggerConfig[] | undefined) ?? [];
  const filtered = triggers.filter(t => t.scriptId !== scriptId);
  await storage.local.set({ [TRIGGERS_KEY]: filtered });
}

// Get per-site override
export async function getSiteOverride(
  scriptId: string,
  url: string
): Promise<boolean | null> {
  const domain = new URL(url).hostname;
  const key = `${OVERRIDE_PREFIX}${scriptId}_${domain}`;
  const result = await storage.local.get(key);
  const override = result[key] as SiteOverride | undefined;
  return override ? override.enabled : null; // null = use trigger default
}

// Set per-site override
export async function setSiteOverride(
  scriptId: string,
  url: string,
  enabled: boolean
): Promise<void> {
  const domain = new URL(url).hostname;
  const key = `${OVERRIDE_PREFIX}${scriptId}_${domain}`;
  await storage.local.set({
    [key]: {
      domain,
      enabled,
      timestamp: Date.now()
    } as SiteOverride
  });
}

// Clear per-site override (revert to trigger default)
export async function clearSiteOverride(
  scriptId: string,
  url: string
): Promise<void> {
  const domain = new URL(url).hostname;
  const key = `${OVERRIDE_PREFIX}${scriptId}_${domain}`;
  await storage.local.remove(key);
}
