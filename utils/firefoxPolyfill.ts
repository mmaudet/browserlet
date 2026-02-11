/**
 * Firefox compatibility polyfill.
 *
 * In Firefox, `browser.*` is the native promise-based API.
 * `chrome.*` exists but uses callbacks, breaking `await chrome.*.get()` etc.
 *
 * This polyfill replaces `chrome` with `browser` in Firefox so all existing
 * code using `chrome.*` works with promises automatically.
 *
 * Must be imported at the TOP of every entry point (background, sidepanel, content).
 */
if (typeof globalThis.browser !== 'undefined' && globalThis.browser.runtime?.id) {
  (globalThis as any).chrome = globalThis.browser;
}
