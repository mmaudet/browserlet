/**
 * Session restoration module for the extension background service worker.
 *
 * Restores previously captured session snapshots by:
 * - Setting cookies via chrome.cookies.set API (supports HttpOnly, SameSite, Secure)
 * - Sending localStorage data to content script for injection
 *
 * Handles pitfalls from research:
 * - Pitfall 1 (HttpOnly): Uses chrome.cookies.set which operates at browser level
 * - Pitfall 2 (SameSite): Maps sameSite values correctly to chrome.cookies enum
 * - Pitfall 3 (Secure flag): Catches individual cookie errors, logs warnings, continues
 * - Pitfall 4 (TTL): Validates snapshot age before restoration
 */

import { decryptApiKey } from '../../utils/crypto/encryption';
import { storage } from '../../utils/storage/browserCompat';
import type { CookieSnapshot, StoredSessionSnapshot } from './sessions';

/**
 * Session snapshot after decryption, includes localStorage data.
 * Extended from sessions.ts SessionSnapshot with localStorage field.
 */
interface RestoredSessionSnapshot {
  cookies: CookieSnapshot[];
  localStorage?: Record<string, string>;
  capturedAt: number; // ms since epoch
  ttl: number;        // ms
}

/** Storage key prefix for session snapshots (must match sessions.ts) */
const SESSION_KEY_PREFIX = 'browserlet_session_';

/**
 * Construct the chrome.storage.local key for a session snapshot.
 */
function buildStorageKey(scriptId: string, domain: string): string {
  return `${SESSION_KEY_PREFIX}${scriptId}_${domain}`;
}

/**
 * Map our sameSite string to chrome.cookies.SameSiteStatus enum value.
 *
 * Chrome's API expects lowercase strings that match the SameSiteStatus enum:
 * "no_restriction", "lax", "strict", "unspecified"
 */
function mapSameSiteStatus(
  sameSite: CookieSnapshot['sameSite']
): chrome.cookies.SameSiteStatus {
  // Chrome's enum values match our stored format directly
  return sameSite as chrome.cookies.SameSiteStatus;
}

/**
 * Construct the URL for chrome.cookies.set from cookie domain and path.
 *
 * Uses https:// for Secure cookies to ensure they are accepted by the browser.
 * Falls back to http:// for non-Secure cookies.
 */
function buildCookieUrl(cookie: CookieSnapshot): string {
  const protocol = cookie.secure ? 'https' : 'http';
  // Remove leading dot from domain for URL construction
  const host = cookie.domain.startsWith('.')
    ? cookie.domain.slice(1)
    : cookie.domain;
  return `${protocol}://${host}${cookie.path}`;
}

/**
 * Restore a previously captured session for a script on a given domain.
 *
 * Reads the encrypted snapshot from chrome.storage.local, decrypts it,
 * then restores cookies via chrome.cookies.set API and sends localStorage
 * data to the content script for injection.
 *
 * @param scriptId - The script identifier
 * @param domain - The target domain
 * @param tabId - The tab to send localStorage restoration message to
 * @returns true if restoration was attempted, false if no valid session found
 */
export async function restoreSession(
  scriptId: string,
  domain: string,
  tabId: number
): Promise<boolean> {
  const storageKey = buildStorageKey(scriptId, domain);

  // Read stored snapshot
  const result = await storage.local.get(storageKey);
  const stored = result[storageKey] as StoredSessionSnapshot | undefined;

  if (!stored) {
    console.log('[Browserlet] No session snapshot found for', scriptId, domain);
    return false;
  }

  // Check TTL expiration
  const age = Date.now() - stored.capturedAt;
  if (age > stored.ttl) {
    console.warn(
      '[Browserlet] Session snapshot expired:',
      Math.round(age / 1000 / 60),
      'minutes old, TTL:',
      Math.round(stored.ttl / 1000 / 60),
      'minutes'
    );
    // Delete expired snapshot
    await storage.local.remove(storageKey);
    return false;
  }

  // Decrypt snapshot using vault encryption (symmetric with encryptApiKey used during capture)
  let snapshot: RestoredSessionSnapshot;
  try {
    const decrypted = await decryptApiKey(stored.encrypted);
    snapshot = JSON.parse(decrypted) as RestoredSessionSnapshot;
  } catch (error) {
    console.error('[Browserlet] Failed to decrypt session snapshot:', error);
    return false;
  }

  // Restore cookies via chrome.cookies.set
  let cookiesRestored = 0;
  let cookiesFailed = 0;

  for (const cookie of snapshot.cookies) {
    try {
      const url = buildCookieUrl(cookie);
      const details: chrome.cookies.SetDetails = {
        url,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: mapSameSiteStatus(cookie.sameSite),
      };

      // Only set expirationDate for persistent cookies (non-null)
      if (cookie.expiresAt !== null && cookie.expiresAt !== undefined) {
        details.expirationDate = cookie.expiresAt;
      }

      await chrome.cookies.set(details);
      cookiesRestored++;
    } catch (error) {
      // Individual cookie failures are non-fatal (Pitfall 3: Secure flag on HTTP)
      cookiesFailed++;
      console.warn(
        `[Browserlet] Failed to restore cookie "${cookie.name}" for ${cookie.domain}:`,
        error
      );
    }
  }

  console.log(
    `[Browserlet] Cookies restored: ${cookiesRestored}/${snapshot.cookies.length}` +
      (cookiesFailed > 0 ? ` (${cookiesFailed} failed)` : '')
  );

  // Restore localStorage via content script message
  if (
    snapshot.localStorage &&
    Object.keys(snapshot.localStorage).length > 0
  ) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'RESTORE_LOCALSTORAGE',
        payload: { data: snapshot.localStorage },
      });
      console.log(
        '[Browserlet] localStorage restoration sent to tab',
        tabId,
        `(${Object.keys(snapshot.localStorage).length} entries)`
      );
    } catch (error) {
      // Content script may not be ready yet - log but don't fail
      console.warn(
        '[Browserlet] Failed to send localStorage restoration to content script:',
        error
      );
    }
  }

  return true;
}
