import type { AppState } from '../../utils/types';

const DEFAULT_STATE: AppState = {
  version: '0.1.0',
  firstInstall: 0,
  lastActivity: 0,
};

export async function getState(): Promise<AppState> {
  const result = await chrome.storage.local.get('appState');
  const appState = result.appState as AppState | undefined;
  return appState ?? DEFAULT_STATE;
}

export async function setState(partial: Partial<AppState>): Promise<AppState> {
  const current = await getState();
  const updated = { ...current, ...partial, lastActivity: Date.now() };
  await chrome.storage.local.set({ appState: updated });
  return updated;
}

export async function initializeState(): Promise<void> {
  const existing = await chrome.storage.local.get('appState');
  if (!existing.appState) {
    await chrome.storage.local.set({
      appState: { ...DEFAULT_STATE, firstInstall: Date.now() },
    });
  }
}
