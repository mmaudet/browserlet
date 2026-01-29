import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

// Import after fake-browser is set up
import { getState, setState, initializeState } from '../../entrypoints/background/storage';
import type { AppState } from '../../utils/types';

describe('Storage Operations', () => {
  beforeEach(() => {
    // Reset fake browser state before each test
    fakeBrowser.reset();
  });

  describe('initializeState', () => {
    it('should initialize default state when storage is empty', async () => {
      await initializeState();

      const result = await chrome.storage.local.get('appState');
      const appState = result.appState as AppState;
      expect(appState).toBeDefined();
      expect(appState.version).toBe('0.1.0');
      expect(appState.firstInstall).toBeGreaterThan(0);
    });

    it('should not overwrite existing state', async () => {
      const existingState = {
        version: '0.0.9',
        firstInstall: 12345,
        lastActivity: 0,
      };
      await chrome.storage.local.set({ appState: existingState });

      await initializeState();

      const result = await chrome.storage.local.get('appState');
      const appState = result.appState as AppState;
      expect(appState.version).toBe('0.0.9');
      expect(appState.firstInstall).toBe(12345);
    });
  });

  describe('getState', () => {
    it('should return default state when storage is empty', async () => {
      const state = await getState();

      expect(state.version).toBe('0.1.0');
      expect(state.firstInstall).toBe(0);
    });

    it('should return stored state', async () => {
      const storedState = {
        version: '1.0.0',
        firstInstall: 99999,
        lastActivity: 88888,
      };
      await chrome.storage.local.set({ appState: storedState });

      const state = await getState();

      expect(state).toEqual(storedState);
    });
  });

  describe('setState', () => {
    it('should merge partial state with existing state', async () => {
      await initializeState();
      const beforeUpdate = await getState();

      const updated = await setState({ version: '2.0.0' });

      expect(updated.version).toBe('2.0.0');
      expect(updated.firstInstall).toBe(beforeUpdate.firstInstall);
      expect(updated.lastActivity).toBeGreaterThan(0);
    });

    it('should update lastActivity timestamp', async () => {
      const before = Date.now();
      await setState({ version: '1.0.0' });
      const after = Date.now();

      const state = await getState();

      expect(state.lastActivity).toBeGreaterThanOrEqual(before);
      expect(state.lastActivity).toBeLessThanOrEqual(after);
    });

    it('should persist state to storage', async () => {
      await setState({ version: '3.0.0' });

      // Directly check storage (simulating service worker restart)
      const result = await chrome.storage.local.get('appState');
      const appState = result.appState as AppState;
      expect(appState.version).toBe('3.0.0');
    });
  });
});
