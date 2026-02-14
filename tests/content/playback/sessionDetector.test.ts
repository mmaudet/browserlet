import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

import {
  checkUrlPatterns,
  checkIndicatorPresent,
  checkAbsenceIndicator,
  checkSessionActive,
  SessionDetector,
  DEFAULT_LOGIN_PATTERNS,
} from '../../../entrypoints/content/playback/sessionDetector';
import type { SemanticHint, SessionCheckConfig } from '@browserlet/core/types';

// Mock the semanticResolver module
vi.mock('../../../entrypoints/content/playback/semanticResolver', () => ({
  resolveElement: vi.fn(),
}));

// Mock the dom utils module
vi.mock('../../../utils/hints/dom', () => ({
  isElementVisible: vi.fn(),
}));

import { resolveElement } from '../../../entrypoints/content/playback/semanticResolver';
import { isElementVisible } from '../../../utils/hints/dom';

const mockResolveElement = vi.mocked(resolveElement);
const mockIsElementVisible = vi.mocked(isElementVisible);

// Set up a minimal DOM environment for each test
let dom: JSDOM;

beforeEach(() => {
  dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost/dashboard',
  });
  global.document = dom.window.document;
  global.window = dom.window as unknown as Window & typeof globalThis;
  global.HTMLElement = dom.window.HTMLElement;
  global.Element = dom.window.Element;

  // Reset mocks
  mockResolveElement.mockReset();
  mockIsElementVisible.mockReset();
});

afterEach(() => {
  dom.window.close();
});

describe('DEFAULT_LOGIN_PATTERNS', () => {
  it('should contain common login page patterns', () => {
    expect(DEFAULT_LOGIN_PATTERNS).toContain('*/login*');
    expect(DEFAULT_LOGIN_PATTERNS).toContain('*/signin*');
    expect(DEFAULT_LOGIN_PATTERNS).toContain('*/sign-in*');
    expect(DEFAULT_LOGIN_PATTERNS).toContain('*/auth/*');
    expect(DEFAULT_LOGIN_PATTERNS).toContain('*/authenticate*');
    expect(DEFAULT_LOGIN_PATTERNS).toContain('*/session/new*');
  });

  it('should have at least 6 common patterns', () => {
    expect(DEFAULT_LOGIN_PATTERNS.length).toBeGreaterThanOrEqual(6);
  });
});

describe('checkUrlPatterns', () => {
  it('should return true when no patterns provided', () => {
    expect(checkUrlPatterns(undefined)).toBe(true);
  });

  it('should return true when empty patterns array', () => {
    expect(checkUrlPatterns([])).toBe(true);
  });

  it('should return false when URL matches login pattern', () => {
    // Update JSDOM URL to login page
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://example.com/login',
    });
    global.window = dom.window as unknown as Window & typeof globalThis;

    const patterns = ['*/login*'];
    expect(checkUrlPatterns(patterns)).toBe(false);
  });

  it('should return true when URL does not match any pattern', () => {
    // URL is localhost/dashboard (not a login page)
    const patterns = ['*/login*', '*/signin*'];
    expect(checkUrlPatterns(patterns)).toBe(true);
  });

  it('should handle wildcard at beginning of pattern', () => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://example.com/auth/login',
    });
    global.window = dom.window as unknown as Window & typeof globalThis;

    expect(checkUrlPatterns(['*/login*'])).toBe(false);
  });

  it('should handle wildcard at end of pattern', () => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://example.com/authenticate-user',
    });
    global.window = dom.window as unknown as Window & typeof globalThis;

    expect(checkUrlPatterns(['*/authenticate*'])).toBe(false);
  });

  it('should handle multiple wildcards', () => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://example.com/app/auth/login/redirect',
    });
    global.window = dom.window as unknown as Window & typeof globalThis;

    expect(checkUrlPatterns(['*/auth/*/redirect*'])).toBe(false);
  });

  it('should be case insensitive', () => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://example.com/LOGIN',
    });
    global.window = dom.window as unknown as Window & typeof globalThis;

    expect(checkUrlPatterns(['*/login*'])).toBe(false);
  });

  it('should return false on first matching pattern', () => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://example.com/signin',
    });
    global.window = dom.window as unknown as Window & typeof globalThis;

    const patterns = ['*/login*', '*/signin*', '*/auth*'];
    expect(checkUrlPatterns(patterns)).toBe(false);
  });
});

describe('checkIndicatorPresent', () => {
  it('should return true when no config provided', () => {
    expect(checkIndicatorPresent(undefined)).toBe(true);
  });

  it('should return true when element found and visible', () => {
    const mockElement = document.createElement('div');
    mockResolveElement.mockReturnValue({
      element: mockElement,
      confidence: 1.0,
      matchedHints: ['role:img'],
      failedHints: [],
    });
    mockIsElementVisible.mockReturnValue(true);

    const config = { hints: [{ type: 'role', value: 'img' }] as SemanticHint[] };
    expect(checkIndicatorPresent(config)).toBe(true);
    expect(mockResolveElement).toHaveBeenCalledWith(config.hints);
    expect(mockIsElementVisible).toHaveBeenCalledWith(mockElement);
  });

  it('should return false when element not found', () => {
    mockResolveElement.mockReturnValue({
      element: null,
      confidence: 0,
      matchedHints: [],
      failedHints: ['role:img'],
    });

    const config = { hints: [{ type: 'role', value: 'img' }] as SemanticHint[] };
    expect(checkIndicatorPresent(config)).toBe(false);
  });

  it('should return false when element found but not visible', () => {
    const mockElement = document.createElement('div');
    mockResolveElement.mockReturnValue({
      element: mockElement,
      confidence: 1.0,
      matchedHints: ['role:img'],
      failedHints: [],
    });
    mockIsElementVisible.mockReturnValue(false);

    const config = { hints: [{ type: 'role', value: 'img' }] as SemanticHint[] };
    expect(checkIndicatorPresent(config)).toBe(false);
  });
});

describe('checkAbsenceIndicator', () => {
  it('should return true when no config provided', () => {
    expect(checkAbsenceIndicator(undefined)).toBe(true);
  });

  it('should return true when login form NOT found (authenticated)', () => {
    mockResolveElement.mockReturnValue({
      element: null,
      confidence: 0,
      matchedHints: [],
      failedHints: ['role:form'],
    });

    const config = { hints: [{ type: 'role', value: 'form' }] as SemanticHint[] };
    expect(checkAbsenceIndicator(config)).toBe(true);
  });

  it('should return true when login form found but not visible (authenticated)', () => {
    const mockElement = document.createElement('form');
    mockResolveElement.mockReturnValue({
      element: mockElement,
      confidence: 1.0,
      matchedHints: ['role:form'],
      failedHints: [],
    });
    mockIsElementVisible.mockReturnValue(false);

    const config = { hints: [{ type: 'role', value: 'form' }] as SemanticHint[] };
    expect(checkAbsenceIndicator(config)).toBe(true);
  });

  it('should return false when login form found and visible (not authenticated)', () => {
    const mockElement = document.createElement('form');
    mockResolveElement.mockReturnValue({
      element: mockElement,
      confidence: 1.0,
      matchedHints: ['role:form'],
      failedHints: [],
    });
    mockIsElementVisible.mockReturnValue(true);

    const config = { hints: [{ type: 'role', value: 'form' }] as SemanticHint[] };
    expect(checkAbsenceIndicator(config)).toBe(false);
  });
});

describe('checkSessionActive', () => {
  it('should return true when all checks pass', () => {
    const mockElement = document.createElement('div');
    mockResolveElement.mockReturnValue({
      element: mockElement,
      confidence: 1.0,
      matchedHints: [],
      failedHints: [],
    });
    mockIsElementVisible.mockReturnValue(true);

    const config: SessionCheckConfig = {
      url_patterns: ['*/login*'],
      indicator: { hints: [{ type: 'role', value: 'img' }] },
    };

    // URL is localhost/dashboard - not a login page
    expect(checkSessionActive(config)).toBe(true);
  });

  it('should return false when URL pattern check fails', () => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://example.com/login',
    });
    global.window = dom.window as unknown as Window & typeof globalThis;

    const config: SessionCheckConfig = {
      url_patterns: ['*/login*'],
    };

    expect(checkSessionActive(config)).toBe(false);
  });

  it('should return false when indicator check fails', () => {
    mockResolveElement.mockReturnValue({
      element: null,
      confidence: 0,
      matchedHints: [],
      failedHints: [],
    });

    const config: SessionCheckConfig = {
      indicator: { hints: [{ type: 'role', value: 'img' }] },
    };

    expect(checkSessionActive(config)).toBe(false);
  });

  it('should return false when absence check fails', () => {
    const mockLoginForm = document.createElement('form');
    mockResolveElement.mockReturnValue({
      element: mockLoginForm,
      confidence: 1.0,
      matchedHints: [],
      failedHints: [],
    });
    mockIsElementVisible.mockReturnValue(true);

    const config: SessionCheckConfig = {
      absence_indicator: { hints: [{ type: 'role', value: 'form' }] },
    };

    expect(checkSessionActive(config)).toBe(false);
  });

  it('should check URL patterns first (short-circuit)', () => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'http://example.com/login',
    });
    global.window = dom.window as unknown as Window & typeof globalThis;

    const config: SessionCheckConfig = {
      url_patterns: ['*/login*'],
      indicator: { hints: [{ type: 'role', value: 'img' }] },
    };

    expect(checkSessionActive(config)).toBe(false);
    // Should not have called resolveElement since URL check failed first
    expect(mockResolveElement).not.toHaveBeenCalled();
  });

  it('should return true with empty config', () => {
    const config: SessionCheckConfig = {};
    expect(checkSessionActive(config)).toBe(true);
  });
});

describe('SessionDetector', () => {
  describe('constructor', () => {
    it('should create detector without config', () => {
      const detector = new SessionDetector();
      expect(detector.isAuthenticated()).toBe(true);
    });

    it('should create detector with config', () => {
      const config: SessionCheckConfig = {
        url_patterns: ['*/login*'],
      };
      const detector = new SessionDetector(config);
      // Not on login page, so authenticated
      expect(detector.isAuthenticated()).toBe(true);
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when no config set', () => {
      const detector = new SessionDetector();
      expect(detector.isAuthenticated()).toBe(true);
    });

    it('should delegate to checkSessionActive', () => {
      const mockElement = document.createElement('div');
      mockResolveElement.mockReturnValue({
        element: mockElement,
        confidence: 1.0,
        matchedHints: [],
        failedHints: [],
      });
      mockIsElementVisible.mockReturnValue(true);

      const config: SessionCheckConfig = {
        indicator: { hints: [{ type: 'role', value: 'img' }] },
      };
      const detector = new SessionDetector(config);

      expect(detector.isAuthenticated()).toBe(true);
      expect(mockResolveElement).toHaveBeenCalled();
    });

    it('should return false when session is not active', () => {
      mockResolveElement.mockReturnValue({
        element: null,
        confidence: 0,
        matchedHints: [],
        failedHints: [],
      });

      const config: SessionCheckConfig = {
        indicator: { hints: [{ type: 'role', value: 'img' }] },
      };
      const detector = new SessionDetector(config);

      expect(detector.isAuthenticated()).toBe(false);
    });
  });

  describe('setConfig', () => {
    it('should update config at runtime', () => {
      const detector = new SessionDetector();
      expect(detector.isAuthenticated()).toBe(true);

      // Set config that makes it not authenticated
      mockResolveElement.mockReturnValue({
        element: null,
        confidence: 0,
        matchedHints: [],
        failedHints: [],
      });

      detector.setConfig({
        indicator: { hints: [{ type: 'role', value: 'missing' }] },
      });

      expect(detector.isAuthenticated()).toBe(false);
    });
  });

  describe('onAuthenticationRequired', () => {
    it('should store callback for later use', () => {
      const detector = new SessionDetector();
      const callback = vi.fn();

      detector.onAuthenticationRequired(callback);

      // Callback should not be called yet
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('waitForAuthentication', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should call onAuthRequired callback when waiting starts', async () => {
      mockResolveElement.mockReturnValue({
        element: null,
        confidence: 0,
        matchedHints: [],
        failedHints: [],
      });

      const config: SessionCheckConfig = {
        indicator: { hints: [{ type: 'role', value: 'img' }] },
      };
      const detector = new SessionDetector(config);
      const callback = vi.fn();
      detector.onAuthenticationRequired(callback);

      // Start waiting (don't await, we want to check callback was called)
      const waitPromise = detector.waitForAuthentication(100);

      // Callback should be called immediately
      expect(callback).toHaveBeenCalledTimes(1);

      // Clean up - make it authenticated and advance time
      mockResolveElement.mockReturnValue({
        element: document.createElement('div'),
        confidence: 1.0,
        matchedHints: [],
        failedHints: [],
      });
      mockIsElementVisible.mockReturnValue(true);

      await vi.advanceTimersByTimeAsync(100);
      await waitPromise;
    });

    it('should poll until authenticated', async () => {
      let callCount = 0;
      mockResolveElement.mockImplementation(() => {
        callCount++;
        if (callCount >= 3) {
          return {
            element: document.createElement('div'),
            confidence: 1.0,
            matchedHints: [],
            failedHints: [],
          };
        }
        return {
          element: null,
          confidence: 0,
          matchedHints: [],
          failedHints: [],
        };
      });
      mockIsElementVisible.mockReturnValue(true);

      const config: SessionCheckConfig = {
        indicator: { hints: [{ type: 'role', value: 'img' }] },
      };
      const detector = new SessionDetector(config);

      const waitPromise = detector.waitForAuthentication(100);

      // Advance time through polling cycles
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(100);

      await waitPromise;
      expect(callCount).toBeGreaterThanOrEqual(3);
    });

    it('should respect custom poll interval', async () => {
      let pollCount = 0;
      mockResolveElement.mockImplementation(() => {
        pollCount++;
        if (pollCount >= 2) {
          return {
            element: document.createElement('div'),
            confidence: 1.0,
            matchedHints: [],
            failedHints: [],
          };
        }
        return {
          element: null,
          confidence: 0,
          matchedHints: [],
          failedHints: [],
        };
      });
      mockIsElementVisible.mockReturnValue(true);

      const config: SessionCheckConfig = {
        indicator: { hints: [{ type: 'role', value: 'img' }] },
      };
      const detector = new SessionDetector(config);

      const waitPromise = detector.waitForAuthentication(500);

      // Advance 500ms (custom interval)
      await vi.advanceTimersByTimeAsync(500);

      await waitPromise;
      expect(pollCount).toBe(2);
    });

    it('should not start waiting if already waiting', async () => {
      mockResolveElement.mockReturnValue({
        element: null,
        confidence: 0,
        matchedHints: [],
        failedHints: [],
      });

      const config: SessionCheckConfig = {
        indicator: { hints: [{ type: 'role', value: 'img' }] },
      };
      const detector = new SessionDetector(config);
      const callback = vi.fn();
      detector.onAuthenticationRequired(callback);

      // Start first wait
      const waitPromise1 = detector.waitForAuthentication(100);

      // Try to start second wait
      const waitPromise2 = detector.waitForAuthentication(100);

      // Callback should only be called once
      expect(callback).toHaveBeenCalledTimes(1);

      // Both promises should be same (second returns immediately)
      // Make it authenticated to resolve
      mockResolveElement.mockReturnValue({
        element: document.createElement('div'),
        confidence: 1.0,
        matchedHints: [],
        failedHints: [],
      });
      mockIsElementVisible.mockReturnValue(true);

      await vi.advanceTimersByTimeAsync(100);
      await Promise.all([waitPromise1, waitPromise2]);
    });

    it('should resolve immediately if already authenticated', async () => {
      const mockElement = document.createElement('div');
      mockResolveElement.mockReturnValue({
        element: mockElement,
        confidence: 1.0,
        matchedHints: [],
        failedHints: [],
      });
      mockIsElementVisible.mockReturnValue(true);

      const config: SessionCheckConfig = {
        indicator: { hints: [{ type: 'role', value: 'img' }] },
      };
      const detector = new SessionDetector(config);

      // Should resolve without polling
      await detector.waitForAuthentication(100);

      // No timers should have been used
    });
  });

  describe('stopWaiting', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should cancel waiting', async () => {
      mockResolveElement.mockReturnValue({
        element: null,
        confidence: 0,
        matchedHints: [],
        failedHints: [],
      });

      const config: SessionCheckConfig = {
        indicator: { hints: [{ type: 'role', value: 'img' }] },
      };
      const detector = new SessionDetector(config);

      const waitPromise = detector.waitForAuthentication(100);

      // Stop waiting after first poll
      await vi.advanceTimersByTimeAsync(50);
      detector.stopWaiting();
      await vi.advanceTimersByTimeAsync(100);

      // Promise should resolve (not hang forever)
      await waitPromise;
    });
  });
});
