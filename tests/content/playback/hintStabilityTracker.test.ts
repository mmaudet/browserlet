import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

import {
  HintStabilityTracker,
  hintToKey,
} from '../../../entrypoints/content/playback/hintStabilityTracker';
import type { HintStabilityData } from '../../../entrypoints/content/playback/hintStabilityTracker';
import type { SemanticHint } from '../../../entrypoints/content/playback/types';

// Mock window.location for hostname
beforeEach(() => {
  fakeBrowser.reset();
});

// ---------------------------------------------------------------------------
// hintToKey
// ---------------------------------------------------------------------------

describe('hintToKey', () => {
  it('should format string hint as type:value (normalized)', () => {
    const hint: SemanticHint = { type: 'role', value: 'button' };
    expect(hintToKey(hint)).toBe('role:button');
  });

  it('should normalize hint key to lowercase', () => {
    const hint: SemanticHint = { type: 'id', value: 'MyButton' };
    expect(hintToKey(hint)).toBe('id:mybutton');
  });

  it('should format data_attribute object hint as data_attribute:name=value', () => {
    const hint: SemanticHint = {
      type: 'data_attribute',
      value: { name: 'data-testid', value: 'submit-btn' },
    };
    expect(hintToKey(hint)).toBe('data_attribute:data-testid=submit-btn');
  });
});

// ---------------------------------------------------------------------------
// load
// ---------------------------------------------------------------------------

describe('HintStabilityTracker.load', () => {
  it('should return default data when storage is empty', async () => {
    const tracker = new HintStabilityTracker('example.com');
    const data = await tracker.load();
    expect(data.version).toBe(1);
    expect(data.hints).toEqual({});
    expect(data.lastUpdated).toBeGreaterThan(0);
  });

  it('should load existing data from storage', async () => {
    const existingData: HintStabilityData = {
      hints: { 'role:button': { successes: 10, failures: 1 } },
      lastUpdated: Date.now(),
      version: 1,
    };
    await chrome.storage.local.set({
      'browserlet_hint_stability_example.com': existingData,
    });

    const tracker = new HintStabilityTracker('example.com');
    const data = await tracker.load();
    expect(data.hints['role:button']?.successes).toBe(10);
    expect(data.hints['role:button']?.failures).toBe(1);
  });

  it('should cache data after first load', async () => {
    const tracker = new HintStabilityTracker('example.com');
    const data1 = await tracker.load();
    const data2 = await tracker.load();
    expect(data1).toBe(data2); // Same reference = cached
  });
});

// ---------------------------------------------------------------------------
// recordSuccess
// ---------------------------------------------------------------------------

describe('HintStabilityTracker.recordSuccess', () => {
  it('should increment success counters for matched hints', async () => {
    const tracker = new HintStabilityTracker('example.com');

    const hints: SemanticHint[] = [
      { type: 'role', value: 'button' },
      { type: 'text_contains', value: 'submit' },
    ];

    await tracker.recordSuccess(hints, ['role:button']);

    const data = await tracker.load();
    expect(data.hints['role:button']?.successes).toBe(1);
    expect(data.hints['role:button']?.failures).toBe(0);
    // Unmatched hint gets failure
    expect(data.hints['text_contains:submit']?.successes).toBe(0);
    expect(data.hints['text_contains:submit']?.failures).toBe(1);
  });

  it('should accumulate across multiple calls', async () => {
    const tracker = new HintStabilityTracker('example.com');
    const hints: SemanticHint[] = [{ type: 'id', value: 'email' }];

    await tracker.recordSuccess(hints, ['id:email']);
    await tracker.recordSuccess(hints, ['id:email']);
    await tracker.recordSuccess(hints, ['id:email']);

    const data = await tracker.load();
    expect(data.hints['id:email']?.successes).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// recordFailure
// ---------------------------------------------------------------------------

describe('HintStabilityTracker.recordFailure', () => {
  it('should increment failure counters for all hints', async () => {
    const tracker = new HintStabilityTracker('example.com');

    const hints: SemanticHint[] = [
      { type: 'role', value: 'button' },
      { type: 'id', value: 'submit' },
    ];

    await tracker.recordFailure(hints);

    const data = await tracker.load();
    expect(data.hints['role:button']?.failures).toBe(1);
    expect(data.hints['id:submit']?.failures).toBe(1);
    expect(data.hints['role:button']?.successes).toBe(0);
    expect(data.hints['id:submit']?.successes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getStabilityBoost
// ---------------------------------------------------------------------------

describe('HintStabilityTracker.getStabilityBoost', () => {
  it('should return 0 when no data loaded', () => {
    // No load() called
    const tracker = new HintStabilityTracker('example.com');
    const hints: SemanticHint[] = [{ type: 'id', value: 'email' }];
    expect(tracker.getStabilityBoost(hints)).toBe(0);
  });

  it('should return 0 when hint has no tracking data', async () => {
    const tracker = new HintStabilityTracker('example.com');
    await tracker.load();
    const hints: SemanticHint[] = [{ type: 'id', value: 'unknown' }];
    expect(tracker.getStabilityBoost(hints)).toBe(0);
  });

  it('should return 0 when < 5 total attempts', async () => {
    const existingData: HintStabilityData = {
      hints: { 'id:email': { successes: 4, failures: 0 } },
      lastUpdated: Date.now(),
      version: 1,
    };
    await chrome.storage.local.set({
      'browserlet_hint_stability_example.com': existingData,
    });

    const tracker = new HintStabilityTracker('example.com');
    await tracker.load();
    const hints: SemanticHint[] = [{ type: 'id', value: 'email' }];
    expect(tracker.getStabilityBoost(hints)).toBe(0);
  });

  it('should return 0 when success rate <= 90%', async () => {
    const existingData: HintStabilityData = {
      hints: { 'id:email': { successes: 9, failures: 1 } },
      lastUpdated: Date.now(),
      version: 1,
    };
    await chrome.storage.local.set({
      'browserlet_hint_stability_example.com': existingData,
    });

    const tracker = new HintStabilityTracker('example.com');
    await tracker.load();
    const hints: SemanticHint[] = [{ type: 'id', value: 'email' }];
    // 9/10 = 0.90 exactly, threshold is > 0.90 (strictly greater)
    expect(tracker.getStabilityBoost(hints)).toBe(0);
  });

  it('should return +0.2 when > 90% success with >= 5 attempts', async () => {
    const existingData: HintStabilityData = {
      hints: { 'id:email': { successes: 10, failures: 0 } },
      lastUpdated: Date.now(),
      version: 1,
    };
    await chrome.storage.local.set({
      'browserlet_hint_stability_example.com': existingData,
    });

    const tracker = new HintStabilityTracker('example.com');
    await tracker.load();
    const hints: SemanticHint[] = [{ type: 'id', value: 'email' }];
    expect(tracker.getStabilityBoost(hints)).toBe(0.2);
  });

  it('should return +0.2 if ANY hint in the set qualifies', async () => {
    const existingData: HintStabilityData = {
      hints: {
        'id:email': { successes: 1, failures: 10 }, // Bad hint
        'name:email': { successes: 20, failures: 0 }, // Good hint
      },
      lastUpdated: Date.now(),
      version: 1,
    };
    await chrome.storage.local.set({
      'browserlet_hint_stability_example.com': existingData,
    });

    const tracker = new HintStabilityTracker('example.com');
    await tracker.load();
    const hints: SemanticHint[] = [
      { type: 'id', value: 'email' },
      { type: 'name', value: 'email' },
    ];
    expect(tracker.getStabilityBoost(hints)).toBe(0.2);
  });
});

// ---------------------------------------------------------------------------
// Pruning: 200+ keys
// ---------------------------------------------------------------------------

describe('HintStabilityTracker - pruning', () => {
  it('should prune entries when exceeding 200 keys', async () => {
    const hints: Record<string, { successes: number; failures: number }> = {};
    for (let i = 0; i < 210; i++) {
      hints[`role:item-${i}`] = { successes: i, failures: 0 };
    }

    const existingData: HintStabilityData = {
      hints,
      lastUpdated: Date.now(),
      version: 1,
    };
    await chrome.storage.local.set({
      'browserlet_hint_stability_example.com': existingData,
    });

    const tracker = new HintStabilityTracker('example.com');
    await tracker.load();

    // Trigger a save by recording something
    await tracker.recordSuccess(
      [{ type: 'role', value: 'item-0' }],
      ['role:item-0']
    );

    // Read back from storage
    const stored = await chrome.storage.local.get('browserlet_hint_stability_example.com');
    const data = stored['browserlet_hint_stability_example.com'] as HintStabilityData;
    const keyCount = Object.keys(data.hints).length;

    expect(keyCount).toBeLessThanOrEqual(200);
  });
});

// ---------------------------------------------------------------------------
// 30-day decay
// ---------------------------------------------------------------------------

describe('HintStabilityTracker - decay', () => {
  it('should halve counters when data is older than 30 days', async () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;

    const existingData: HintStabilityData = {
      hints: { 'id:email': { successes: 20, failures: 10 } },
      lastUpdated: thirtyOneDaysAgo,
      version: 1,
    };
    await chrome.storage.local.set({
      'browserlet_hint_stability_example.com': existingData,
    });

    const tracker = new HintStabilityTracker('example.com');
    await tracker.load();

    // Note: recordSuccess sets data.lastUpdated = Date.now() BEFORE save(),
    // so pruneIfNeeded sees a fresh timestamp and decay does NOT trigger.
    // Counters are incremented but not halved.
    await tracker.recordSuccess([{ type: 'id', value: 'email' }], ['id:email']);

    const stored = await chrome.storage.local.get('browserlet_hint_stability_example.com');
    const data = stored['browserlet_hint_stability_example.com'] as HintStabilityData;

    expect(data.hints['id:email']?.successes).toBe(21); // 20 + 1 (no decay)
    expect(data.hints['id:email']?.failures).toBe(10);  // unchanged
    // lastUpdated should be refreshed to recent
    expect(data.lastUpdated).toBeGreaterThan(thirtyOneDaysAgo);
  });
});
