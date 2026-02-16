/**
 * Session storage module for cookie capture, encryption, and storage.
 *
 * Captures all cookies (including HttpOnly) for a given domain via
 * chrome.cookies API (privileged extension API), encrypts them using
 * vault encryption, and stores snapshots in chrome.storage.local.
 *
 * Key prefix: browserlet_session_{scriptId}_{domain}
 * Default TTL: 1 hour (3600000ms)
 */

import { encryptApiKey } from '../../utils/crypto/encryption';
import { storage } from '../../utils/storage/browserCompat';
import type { EncryptedData } from '../../utils/crypto/encryption';

// --- Type Definitions ---

/** Cookie snapshot with full metadata */
export interface CookieSnapshot {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: 'unspecified' | 'lax' | 'strict' | 'no_restriction';
  expiresAt: number | null; // Unix timestamp in seconds, null for session cookies
}

/** Full session snapshot before encryption */
export interface SessionSnapshot {
  cookies: CookieSnapshot[];
  capturedAt: number; // Unix timestamp in milliseconds
  ttl: number; // TTL in milliseconds
}

/** Composite key for session storage lookup */
export interface SessionSnapshotKey {
  scriptId: string;
  domain: string;
}

/** Stored (encrypted) session snapshot in chrome.storage.local */
export interface StoredSessionSnapshot {
  encrypted: EncryptedData;
  capturedAt: number;
  ttl: number;
}

// --- Constants ---

const SESSION_KEY_PREFIX = 'browserlet_session_';
const DEFAULT_TTL_MS = 3600000; // 1 hour

// --- Helper Functions ---

/**
 * Build storage key from scriptId and domain.
 */
function buildStorageKey(scriptId: string, domain: string): string {
  return `${SESSION_KEY_PREFIX}${scriptId}_${domain}`;
}

/**
 * Normalize chrome.cookies sameSite value to our type.
 * Chrome cookie.sameSite is already a string matching our type.
 * This function provides a safe fallback for unexpected values.
 */
function normalizeSameSite(
  sameSite: string
): CookieSnapshot['sameSite'] {
  switch (sameSite) {
    case 'lax':
      return 'lax';
    case 'strict':
      return 'strict';
    case 'no_restriction':
      return 'no_restriction';
    case 'unspecified':
    default:
      return 'unspecified';
  }
}

// --- Core Functions ---

/**
 * Capture all cookies for the given tab's domain and store encrypted snapshot.
 *
 * Uses chrome.cookies.getAll which has elevated extension privileges to
 * capture HttpOnly cookies that are inaccessible to document.cookie.
 *
 * @param scriptId - Script identifier for namespacing
 * @param tabId - Tab ID to capture cookies from (used to determine domain)
 */
export async function captureSession(
  scriptId: string,
  tabId: number
): Promise<void> {
  try {
    // Get tab URL to determine domain
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) {
      console.warn('[Browserlet] Cannot capture session: tab has no URL');
      return;
    }

    const url = new URL(tab.url);
    const domain = url.hostname;

    // Capture ALL cookies for this domain (including HttpOnly)
    const cookies = await chrome.cookies.getAll({ domain });

    // Map to full metadata snapshot
    const cookieSnapshots: CookieSnapshot[] = cookies.map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: normalizeSameSite(cookie.sameSite),
      expiresAt: cookie.expirationDate ?? null,
    }));

    // Create session snapshot
    const snapshot: SessionSnapshot = {
      cookies: cookieSnapshots,
      capturedAt: Date.now(),
      ttl: DEFAULT_TTL_MS,
    };

    // Encrypt the snapshot using vault encryption
    const json = JSON.stringify(snapshot);
    const encrypted = await encryptApiKey(json);

    // Build stored snapshot with metadata (unencrypted for TTL checks)
    const stored: StoredSessionSnapshot = {
      encrypted,
      capturedAt: snapshot.capturedAt,
      ttl: snapshot.ttl,
    };

    // Store in chrome.storage.local with namespaced key
    const key = buildStorageKey(scriptId, domain);
    await storage.local.set({ [key]: stored });

    console.log(
      `[Browserlet] Session captured for ${domain} (${cookieSnapshots.length} cookies, script: ${scriptId})`
    );
  } catch (error) {
    // Non-fatal: capture failures should not break script execution
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[Browserlet] Failed to capture session: ${msg}`);
  }
}

/**
 * Check session status for a given script and domain.
 *
 * @param scriptId - Script identifier
 * @param domain - Domain to check
 * @returns Status object with exists, expired, and optional capturedAt
 */
export async function getSessionStatus(
  scriptId: string,
  domain: string
): Promise<{ exists: boolean; expired: boolean; capturedAt?: number }> {
  const key = buildStorageKey(scriptId, domain);
  const data = await storage.local.get(key);
  const stored = data[key] as StoredSessionSnapshot | undefined;

  if (!stored) {
    return { exists: false, expired: false };
  }

  const expired = stored.capturedAt + stored.ttl < Date.now();
  return {
    exists: true,
    expired,
    capturedAt: stored.capturedAt,
  };
}

/**
 * Remove a session snapshot for a given script and domain.
 * Idempotent: silently succeeds if key does not exist.
 *
 * @param scriptId - Script identifier
 * @param domain - Domain to clear
 */
export async function clearSession(
  scriptId: string,
  domain: string
): Promise<void> {
  const key = buildStorageKey(scriptId, domain);
  await storage.local.remove(key);
}

/**
 * Cleanup expired session snapshots from storage.
 * Called on startup to prevent stale data accumulation.
 *
 * @returns Number of expired sessions removed
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const allData = await storage.local.get(null);
  const sessionKeys = Object.keys(allData).filter((key) =>
    key.startsWith(SESSION_KEY_PREFIX)
  );

  const now = Date.now();
  const expiredKeys: string[] = [];

  for (const key of sessionKeys) {
    const stored = allData[key] as StoredSessionSnapshot | undefined;
    if (stored && stored.capturedAt + stored.ttl < now) {
      expiredKeys.push(key);
    }
  }

  if (expiredKeys.length > 0) {
    await storage.local.remove(expiredKeys);
    console.log(
      `[Browserlet] Cleaned up ${expiredKeys.length} expired session snapshots`
    );
  }

  return expiredKeys.length;
}
