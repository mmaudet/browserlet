/**
 * Cross-browser API compatibility.
 *
 * Firefox provides `browser.*` (promise-based, native).
 * Chrome provides `chrome.*` (promise-based in MV3).
 * This module exports the correct API for both browsers.
 */
const browserAPI: typeof chrome = (globalThis as any).browser ?? (globalThis as any).chrome;

export const storage = browserAPI.storage;
