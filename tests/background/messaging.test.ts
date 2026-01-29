import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

import { handleMessage } from '../../entrypoints/background/messaging';

describe('Message Routing', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  const createMockSender = (): chrome.runtime.MessageSender => ({
    id: 'test-extension-id',
    url: 'https://example.com',
    tab: {
      id: 1,
      index: 0,
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: true,
      incognito: false,
      selected: false,
      discarded: false,
      autoDiscardable: true,
      groupId: -1,
      frozen: false,
    },
  });

  describe('PING message', () => {
    it('should respond with success and timestamp', async () => {
      const sendResponse = vi.fn();
      const before = Date.now();

      handleMessage({ type: 'PING' }, createMockSender(), sendResponse);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            status: 'ok',
            timestamp: expect.any(Number),
          }),
        })
      );

      const response = sendResponse.mock.calls[0]?.[0] as { data?: { timestamp?: number } };
      expect(response?.data?.timestamp).toBeGreaterThanOrEqual(before);
    });
  });

  describe('GET_STATE message', () => {
    it('should return current app state', async () => {
      // Set up initial state
      await chrome.storage.local.set({
        appState: { version: '1.0.0', firstInstall: 12345, lastActivity: 0 },
      });

      const sendResponse = vi.fn();
      handleMessage({ type: 'GET_STATE' }, createMockSender(), sendResponse);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            version: '1.0.0',
            firstInstall: 12345,
          }),
        })
      );
    });
  });

  describe('SET_STATE message', () => {
    it('should update state and return updated value', async () => {
      const sendResponse = vi.fn();

      handleMessage(
        { type: 'SET_STATE', payload: { version: '2.0.0' } },
        createMockSender(),
        sendResponse
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            version: '2.0.0',
          }),
        })
      );
    });
  });

  describe('Unknown message type', () => {
    it('should return error for unknown message type', async () => {
      const sendResponse = vi.fn();

      handleMessage(
        { type: 'UNKNOWN_TYPE' as any },
        createMockSender(),
        sendResponse
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Unknown message type'),
        })
      );
    });
  });

  describe('handleMessage return value', () => {
    it('should return true to keep message channel open', () => {
      const result = handleMessage(
        { type: 'PING' },
        createMockSender(),
        vi.fn()
      );
      expect(result).toBe(true);
    });
  });
});
