import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  randomDelay,
  humanizedWait,
  typeCharacterDelay,
  scrollSettleDelay,
  DEFAULT_CONFIG,
  HumanizerConfig,
} from '../../../entrypoints/content/playback/humanizer';

describe('Humanizer', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have baseDelay range 500-2000ms', () => {
      expect(DEFAULT_CONFIG.baseDelay.min).toBe(500);
      expect(DEFAULT_CONFIG.baseDelay.max).toBe(2000);
    });

    it('should have typeDelay range 50-150ms', () => {
      expect(DEFAULT_CONFIG.typeDelay.min).toBe(50);
      expect(DEFAULT_CONFIG.typeDelay.max).toBe(150);
    });

    it('should have scrollDelay range 100-300ms', () => {
      expect(DEFAULT_CONFIG.scrollDelay.min).toBe(100);
      expect(DEFAULT_CONFIG.scrollDelay.max).toBe(300);
    });
  });

  describe('randomDelay', () => {
    it('should return values within min-max range (100 iterations)', () => {
      const min = 500;
      const max = 2000;

      for (let i = 0; i < 100; i++) {
        const result = randomDelay(min, max);
        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThanOrEqual(max);
      }
    });

    it('should return different values across multiple calls', () => {
      const results = new Set<number>();

      for (let i = 0; i < 20; i++) {
        results.add(randomDelay(0, 1000));
      }

      // Should have multiple unique values (not constant)
      expect(results.size).toBeGreaterThan(1);
    });

    it('should handle edge case where min === max', () => {
      const result = randomDelay(100, 100);
      expect(result).toBe(100);
    });

    it('should handle small ranges', () => {
      for (let i = 0; i < 50; i++) {
        const result = randomDelay(50, 55);
        expect(result).toBeGreaterThanOrEqual(50);
        expect(result).toBeLessThanOrEqual(55);
      }
    });

    it('should handle zero as minimum', () => {
      for (let i = 0; i < 50; i++) {
        const result = randomDelay(0, 100);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('humanizedWait', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should resolve after delay', async () => {
      const waitPromise = humanizedWait();

      // Promise should not be resolved yet
      let resolved = false;
      waitPromise.then(() => {
        resolved = true;
      });

      // Advance time past max baseDelay
      await vi.advanceTimersByTimeAsync(DEFAULT_CONFIG.baseDelay.max + 100);

      expect(resolved).toBe(true);
    });

    it('should use DEFAULT_CONFIG when no config provided', async () => {
      // Mock randomDelay behavior by checking setTimeout is called
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      humanizedWait();

      expect(setTimeoutSpy).toHaveBeenCalled();
      const delay = setTimeoutSpy.mock.calls[0]?.[1] as number;

      // Delay should be within DEFAULT_CONFIG.baseDelay range
      expect(delay).toBeGreaterThanOrEqual(DEFAULT_CONFIG.baseDelay.min);
      expect(delay).toBeLessThanOrEqual(DEFAULT_CONFIG.baseDelay.max);

      setTimeoutSpy.mockRestore();
    });

    it('should merge partial config with defaults', async () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      const customConfig: Partial<HumanizerConfig> = {
        baseDelay: { min: 100, max: 200 },
      };

      humanizedWait(customConfig);

      expect(setTimeoutSpy).toHaveBeenCalled();
      const delay = setTimeoutSpy.mock.calls[0]?.[1] as number;

      // Delay should be within custom baseDelay range
      expect(delay).toBeGreaterThanOrEqual(100);
      expect(delay).toBeLessThanOrEqual(200);

      setTimeoutSpy.mockRestore();
    });
  });

  describe('typeCharacterDelay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should use typeDelay range from config', async () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      typeCharacterDelay();

      expect(setTimeoutSpy).toHaveBeenCalled();
      const delay = setTimeoutSpy.mock.calls[0]?.[1] as number;

      // Delay should be within DEFAULT_CONFIG.typeDelay range
      expect(delay).toBeGreaterThanOrEqual(DEFAULT_CONFIG.typeDelay.min);
      expect(delay).toBeLessThanOrEqual(DEFAULT_CONFIG.typeDelay.max);

      setTimeoutSpy.mockRestore();
    });

    it('should resolve after delay', async () => {
      const waitPromise = typeCharacterDelay();

      let resolved = false;
      waitPromise.then(() => {
        resolved = true;
      });

      // Advance time past max typeDelay
      await vi.advanceTimersByTimeAsync(DEFAULT_CONFIG.typeDelay.max + 100);

      expect(resolved).toBe(true);
    });

    it('should accept custom config', async () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      const customConfig: Partial<HumanizerConfig> = {
        typeDelay: { min: 10, max: 20 },
      };

      typeCharacterDelay(customConfig);

      const delay = setTimeoutSpy.mock.calls[0]?.[1] as number;
      expect(delay).toBeGreaterThanOrEqual(10);
      expect(delay).toBeLessThanOrEqual(20);

      setTimeoutSpy.mockRestore();
    });
  });

  describe('scrollSettleDelay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should use scrollDelay range from config', async () => {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

      scrollSettleDelay();

      expect(setTimeoutSpy).toHaveBeenCalled();
      const delay = setTimeoutSpy.mock.calls[0]?.[1] as number;

      // Delay should be within DEFAULT_CONFIG.scrollDelay range
      expect(delay).toBeGreaterThanOrEqual(DEFAULT_CONFIG.scrollDelay.min);
      expect(delay).toBeLessThanOrEqual(DEFAULT_CONFIG.scrollDelay.max);

      setTimeoutSpy.mockRestore();
    });

    it('should resolve after delay', async () => {
      const waitPromise = scrollSettleDelay();

      let resolved = false;
      waitPromise.then(() => {
        resolved = true;
      });

      // Advance time past max scrollDelay
      await vi.advanceTimersByTimeAsync(DEFAULT_CONFIG.scrollDelay.max + 100);

      expect(resolved).toBe(true);
    });
  });
});
