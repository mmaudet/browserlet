/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Note: These tests use manual mocking since context-check.ts
// accesses chrome.runtime directly, not through fake-browser's proxy

describe('Context Validation', () => {
  let originalChrome: typeof chrome;

  beforeEach(() => {
    // Store original chrome object
    originalChrome = globalThis.chrome;
    // Reset modules to ensure fresh import
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original chrome object
    globalThis.chrome = originalChrome;
    // Clean up any DOM modifications
    document.getElementById('browserlet-update-banner')?.remove();
  });

  describe('isContextValid', () => {
    it('should return true when chrome.runtime.id is defined', async () => {
      // Mock chrome.runtime with valid id
      globalThis.chrome = {
        runtime: { id: 'test-extension-id' },
      } as typeof chrome;

      const { isContextValid } = await import('../../utils/context-check');
      expect(isContextValid()).toBe(true);
    });

    it('should return false when chrome.runtime.id is undefined', async () => {
      // Mock chrome.runtime with undefined id (context invalidated)
      globalThis.chrome = {
        runtime: { id: undefined },
      } as unknown as typeof chrome;

      const { isContextValid } = await import('../../utils/context-check');
      expect(isContextValid()).toBe(false);
    });

    it('should return false when chrome.runtime is undefined', async () => {
      // Mock chrome without runtime
      globalThis.chrome = {} as typeof chrome;

      const { isContextValid } = await import('../../utils/context-check');
      expect(isContextValid()).toBe(false);
    });

    it('should return false when chrome is undefined', async () => {
      // Mock no chrome object at all
      // @ts-expect-error - intentionally setting to undefined
      globalThis.chrome = undefined;

      const { isContextValid } = await import('../../utils/context-check');
      expect(isContextValid()).toBe(false);
    });
  });

  describe('showUpdateBanner', () => {
    beforeEach(() => {
      // Set up minimal DOM
      document.body.innerHTML = '';
    });

    it('should create banner element in DOM', async () => {
      const { showUpdateBanner } = await import('../../utils/context-check');

      showUpdateBanner();

      const banner = document.getElementById('browserlet-update-banner');
      expect(banner).not.toBeNull();
      expect(banner?.textContent).toContain('Browserlet');
      expect(banner?.textContent).toContain('refresh');
    });

    it('should not create duplicate banners', async () => {
      const { showUpdateBanner } = await import('../../utils/context-check');

      showUpdateBanner();
      showUpdateBanner();
      showUpdateBanner();

      const banners = document.querySelectorAll('#browserlet-update-banner');
      expect(banners.length).toBe(1);
    });

    it('should have refresh button that reloads page', async () => {
      const { showUpdateBanner } = await import('../../utils/context-check');
      const reloadMock = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true,
        configurable: true,
      });

      showUpdateBanner();

      const refreshBtn = document.getElementById('browserlet-refresh-btn');
      expect(refreshBtn).not.toBeNull();
      refreshBtn?.click();
      expect(reloadMock).toHaveBeenCalled();
    });

    it('should have dismiss button that removes banner', async () => {
      const { showUpdateBanner } = await import('../../utils/context-check');

      showUpdateBanner();
      expect(document.getElementById('browserlet-update-banner')).not.toBeNull();

      const dismissBtn = document.getElementById('browserlet-dismiss-btn');
      dismissBtn?.click();

      expect(document.getElementById('browserlet-update-banner')).toBeNull();
    });
  });
});
