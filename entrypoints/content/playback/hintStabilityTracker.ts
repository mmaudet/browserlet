/**
 * HintStabilityTracker - Per-site hint success/failure tracking and confidence boosting
 *
 * Purpose: Tracks which hints reliably resolve elements on a per-site basis.
 * Hints with >90% success rate (and >= 5 attempts) receive a +0.2 confidence boost,
 * creating a learning loop that improves resolution without LLM involvement.
 *
 * Storage: Aggregated counters in chrome.storage.local via browserCompat polyfill.
 * Key format: browserlet_hint_stability_{hostname}
 * Bounded: max 200 hint keys per site, 30-day counter decay.
 */

import { storage } from '../../../utils/storage/browserCompat';
import type { SemanticHint } from '../recording/types';
import { normalizeText } from '../../../utils/hints/text';

/** Aggregated counter for a single hint key on a specific site (RSLV-11) */
interface HintCounter {
  successes: number;
  failures: number;
}

/** Per-site stability data stored in chrome.storage.local */
export interface HintStabilityData {
  /** Map of hint key -> aggregated counter */
  hints: Record<string, HintCounter>;
  /** Last update timestamp (for potential future cleanup) */
  lastUpdated: number;
  /** Schema version for future migrations */
  version: 1;
}

/** Maximum hint keys per site to bound storage growth (RSLV-11) */
const MAX_HINT_KEYS = 200;

/** Decay period: halve counters after 30 days of inactivity */
const DECAY_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Minimum success rate for stability boost (RSLV-12) */
const STABILITY_SUCCESS_THRESHOLD = 0.9;

/** Minimum total attempts before stability boost applies */
const MIN_ATTEMPTS = 5;

/** Flat stability boost value (RSLV-12) */
const STABILITY_BOOST = 0.2;

/**
 * Convert a SemanticHint to its storage key string.
 * Format: {type}:{normalizedValue} for strings, data_attribute:{name}={value} for objects.
 */
export function hintToKey(hint: SemanticHint): string {
  if (typeof hint.value === 'string') {
    return normalizeText(hint.type + ':' + hint.value);
  }
  // data_attribute with object value
  return 'data_attribute:' + normalizeText(hint.value.name + '=' + hint.value.value);
}

/**
 * HintStabilityTracker - Tracks per-site hint reliability and provides confidence boosts.
 *
 * Usage:
 * 1. Create instance: `const tracker = new HintStabilityTracker()`
 * 2. Load data: `await tracker.load()`
 * 3. Get boost: `tracker.getStabilityBoost(hints)` -> 0 or 0.2
 * 4. After resolution: `await tracker.recordSuccess(hints, matchedKeys)` or `await tracker.recordFailure(hints)`
 */
export class HintStabilityTracker {
  private hostname: string;
  private storageKey: string;
  private cache: HintStabilityData | null = null;

  constructor(hostname?: string) {
    this.hostname = hostname ?? window.location.hostname;
    this.storageKey = `browserlet_hint_stability_${this.hostname}`;
  }

  /**
   * Load stability data from storage, caching for session lifetime.
   * Returns cached data on subsequent calls.
   */
  async load(): Promise<HintStabilityData> {
    if (this.cache) return this.cache;

    try {
      const result = await storage.local.get(this.storageKey);
      const data = result[this.storageKey] as HintStabilityData | undefined;

      if (data && data.version === 1) {
        this.cache = data;
      } else {
        this.cache = this.createDefault();
      }
    } catch {
      this.cache = this.createDefault();
    }

    return this.cache;
  }

  /**
   * Record successful resolution: increment successes for matched hints, failures for unmatched.
   * (RSLV-10)
   *
   * @param hints - All hints from the step
   * @param matchedHintKeys - Array of "{type}:{value}" strings that matched (from ResolverResult.matchedHints)
   */
  async recordSuccess(hints: SemanticHint[], matchedHintKeys: string[]): Promise<void> {
    const data = await this.load();
    const matchedSet = new Set(matchedHintKeys.map(k => normalizeText(k)));

    for (const hint of hints) {
      const key = hintToKey(hint);
      if (!data.hints[key]) {
        data.hints[key] = { successes: 0, failures: 0 };
      }

      if (matchedSet.has(key)) {
        data.hints[key]!.successes++;
      } else {
        data.hints[key]!.failures++;
      }
    }

    data.lastUpdated = Date.now();
    await this.save(data);
  }

  /**
   * Record failed resolution: increment failures for ALL hints.
   * (RSLV-10)
   */
  async recordFailure(hints: SemanticHint[]): Promise<void> {
    const data = await this.load();

    for (const hint of hints) {
      const key = hintToKey(hint);
      if (!data.hints[key]) {
        data.hints[key] = { successes: 0, failures: 0 };
      }
      data.hints[key]!.failures++;
    }

    data.lastUpdated = Date.now();
    await this.save(data);
  }

  /**
   * Get stability boost for a set of hints.
   * Returns +0.2 if ANY hint has >90% success rate with >= 5 attempts.
   * Returns 0 otherwise. (RSLV-12)
   *
   * Must call load() first to populate cache.
   */
  getStabilityBoost(hints: SemanticHint[]): number {
    if (!this.cache) return 0;

    for (const hint of hints) {
      const key = hintToKey(hint);
      const counter = this.cache.hints[key];
      if (!counter) continue;

      const total = counter.successes + counter.failures;
      if (total < MIN_ATTEMPTS) continue;

      const rate = counter.successes / total;
      if (rate > STABILITY_SUCCESS_THRESHOLD) {
        return STABILITY_BOOST;
      }
    }

    return 0;
  }

  /**
   * Get success rate for a specific hint key. Returns null if no data.
   * Used for debugging/logging.
   */
  getHintSuccessRate(hintKey: string): number | null {
    if (!this.cache) return null;

    const counter = this.cache.hints[hintKey];
    if (!counter) return null;

    const total = counter.successes + counter.failures;
    if (total === 0) return null;

    return counter.successes / total;
  }

  /**
   * Save data to storage, pruning if needed.
   */
  private async save(data: HintStabilityData): Promise<void> {
    const pruned = this.pruneIfNeeded(data);
    this.cache = pruned;

    try {
      await storage.local.set({ [this.storageKey]: pruned });
    } catch (error) {
      console.error('[Browserlet] Failed to save hint stability data:', error);
    }
  }

  /**
   * Prune stability data to prevent unbounded growth. (RSLV-11)
   *
   * - If >200 hint keys: remove least-used entries (lowest total = successes + failures)
   * - If lastUpdated > 30 days ago: halve all counters (integer division) to decay stale data
   */
  private pruneIfNeeded(data: HintStabilityData): HintStabilityData {
    // Apply decay if data is stale
    if (Date.now() - data.lastUpdated > DECAY_PERIOD_MS) {
      for (const key of Object.keys(data.hints)) {
        const counter = data.hints[key]!;
        counter.successes = Math.floor(counter.successes / 2);
        counter.failures = Math.floor(counter.failures / 2);

        // Remove entries that have decayed to zero
        if (counter.successes === 0 && counter.failures === 0) {
          delete data.hints[key];
        }
      }
      data.lastUpdated = Date.now();
    }

    // Prune if exceeding max keys
    const keys = Object.keys(data.hints);
    if (keys.length > MAX_HINT_KEYS) {
      // Sort by total usage (ascending) and remove least-used
      const sorted = keys.sort((a, b) => {
        const totalA = (data.hints[a]?.successes ?? 0) + (data.hints[a]?.failures ?? 0);
        const totalB = (data.hints[b]?.successes ?? 0) + (data.hints[b]?.failures ?? 0);
        return totalA - totalB;
      });

      const toRemove = sorted.slice(0, keys.length - MAX_HINT_KEYS);
      for (const key of toRemove) {
        delete data.hints[key];
      }
    }

    return data;
  }

  /**
   * Create default stability data structure.
   */
  private createDefault(): HintStabilityData {
    return {
      hints: {},
      lastUpdated: Date.now(),
      version: 1,
    };
  }
}
