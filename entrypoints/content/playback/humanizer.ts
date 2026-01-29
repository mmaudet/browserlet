/**
 * Humanization layer for realistic delays between automation actions.
 * Uses Gaussian distribution for natural timing variations.
 */

export interface HumanizerConfig {
  baseDelay: { min: number; max: number };   // ms between actions (500-2000)
  typeDelay: { min: number; max: number };   // ms between keystrokes (50-150)
  scrollDelay: { min: number; max: number }; // ms for scroll settle (100-300)
}

export const DEFAULT_CONFIG: HumanizerConfig = {
  baseDelay: { min: 500, max: 2000 },
  typeDelay: { min: 50, max: 150 },
  scrollDelay: { min: 100, max: 300 }
};

/**
 * Generate a random delay using Gaussian (normal) distribution.
 * Uses Box-Muller transform for natural feel.
 *
 * @param min - Minimum delay in ms
 * @param max - Maximum delay in ms
 * @returns Random delay within range, Gaussian-distributed
 */
export function randomDelay(min: number, max: number): number {
  // Handle edge case where min === max
  if (min === max) {
    return min;
  }

  // Box-Muller transform for Gaussian distribution
  const u = Math.random();
  const v = Math.random();

  // Avoid log(0) which would produce -Infinity
  const safeU = Math.max(u, 1e-10);

  // Standard normal distribution (mean=0, stddev=1)
  const gaussian = Math.sqrt(-2 * Math.log(safeU)) * Math.cos(2 * Math.PI * v);

  // Normalize to 0-1 range (99.7% of values fall within [-3, 3])
  const normalized = (gaussian + 3) / 6;

  // Clamp to [0, 1] for edge cases
  const clamped = Math.max(0, Math.min(1, normalized));

  // Map to min-max range
  const result = min + clamped * (max - min);

  // Final clamp to ensure we stay within bounds
  return Math.max(min, Math.min(max, result));
}

/**
 * Wait for a humanized delay between actions.
 * Uses baseDelay range from config.
 *
 * @param config - Optional partial config to override defaults
 */
export function humanizedWait(config?: Partial<HumanizerConfig>): Promise<void> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const delay = randomDelay(mergedConfig.baseDelay.min, mergedConfig.baseDelay.max);

  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

/**
 * Wait for a humanized delay between keystrokes.
 * Uses typeDelay range for natural typing feel.
 *
 * @param config - Optional partial config to override defaults
 */
export function typeCharacterDelay(config?: Partial<HumanizerConfig>): Promise<void> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const delay = randomDelay(mergedConfig.typeDelay.min, mergedConfig.typeDelay.max);

  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

/**
 * Wait for scroll animation to settle.
 * Uses scrollDelay range.
 *
 * @param config - Optional partial config to override defaults
 */
export function scrollSettleDelay(config?: Partial<HumanizerConfig>): Promise<void> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const delay = randomDelay(mergedConfig.scrollDelay.min, mergedConfig.scrollDelay.max);

  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}
