/**
 * Browser detection utility for cross-browser compatibility
 * Uses WXT's build-time environment variables
 */

/**
 * True when building for Firefox
 */
export const isFirefox = import.meta.env.FIREFOX === true;

/**
 * True when building for Chrome (or Chromium-based browsers)
 */
export const isChrome = !isFirefox;
