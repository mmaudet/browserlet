/**
 * LocalStorage bridge for capturing and restoring page localStorage
 * from the content script context.
 *
 * Content scripts have access to the page's localStorage (not extension storage),
 * making them the only way to read/write localStorage for session persistence.
 *
 * Error handling:
 * - SecurityError: Occurs on file://, data:, cross-origin iframes, or when
 *   storage access is blocked by browser policy
 * - QuotaExceededError: Occurs when localStorage quota is full during restoration
 */

/**
 * Capture all localStorage entries for the current page.
 *
 * Iterates through localStorage keys and builds a serializable
 * key-value object. Runs synchronously (localStorage is a sync API).
 *
 * @returns Record of all localStorage key-value pairs, or empty object on error
 */
export function captureLocalStorage(): Record<string, string> {
  try {
    const data: Record<string, string> = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          data[key] = value;
        }
      }
    }

    console.log(
      `[Browserlet] Captured ${Object.keys(data).length} localStorage entries`
    );
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      console.warn(
        '[Browserlet] Cannot capture localStorage: access denied (SecurityError)',
        window.location.href
      );
    } else {
      console.warn('[Browserlet] Failed to capture localStorage:', error);
    }
    return {};
  }
}

/**
 * Restore localStorage entries for the current page.
 *
 * Sets each key-value pair in localStorage. Individual setItem errors
 * are logged but do not abort the entire restoration.
 *
 * @param data - Record of key-value pairs to restore
 */
export function restoreLocalStorage(data: Record<string, string>): void {
  if (!data || typeof data !== 'object') {
    console.warn('[Browserlet] restoreLocalStorage called with invalid data');
    return;
  }

  const keys = Object.keys(data);
  if (keys.length === 0) {
    return;
  }

  let restored = 0;
  let failed = 0;

  try {
    for (const key of keys) {
      try {
        const value = data[key];
        if (value !== undefined) {
          localStorage.setItem(key, value);
        }
        restored++;
      } catch (itemError) {
        failed++;
        if (
          itemError instanceof DOMException &&
          itemError.name === 'QuotaExceededError'
        ) {
          console.warn(
            `[Browserlet] localStorage quota exceeded while restoring key "${key}"`
          );
          // Stop trying to add more entries if quota is exceeded
          break;
        } else {
          console.warn(
            `[Browserlet] Failed to restore localStorage key "${key}":`,
            itemError
          );
        }
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      console.warn(
        '[Browserlet] Cannot restore localStorage: access denied (SecurityError)',
        window.location.href
      );
    } else {
      console.warn('[Browserlet] Failed to restore localStorage:', error);
    }
    return;
  }

  console.log(
    `[Browserlet] Restored ${restored}/${keys.length} localStorage entries` +
      (failed > 0 ? ` (${failed} failed)` : '')
  );
}
