import type { AppState } from '../../utils/types';

const DEFAULT_STATE: AppState = {
  version: '0.1.0',
  firstInstall: 0,
  lastActivity: 0,
  recordingState: 'idle',
  recordedActions: [],
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

export async function setRecordingState(state: 'idle' | 'recording' | 'paused'): Promise<AppState> {
  return setState({ recordingState: state });
}

export async function addRecordedAction(action: AppState['recordedActions'][0]): Promise<void> {
  const state = await getState();
  const actions = [...state.recordedActions, action];
  await setState({ recordedActions: actions });
}

export async function clearRecordedActions(): Promise<void> {
  await setState({ recordedActions: [], recordingState: 'idle' });
}
