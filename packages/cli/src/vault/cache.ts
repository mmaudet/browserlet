/**
 * Vault cache module for encrypting and storing derived CryptoKeys in temp files.
 *
 * Purpose: Eliminates repeated master password prompts by caching the derived
 * encryption key in an encrypted temp file with TTL-based expiration.
 *
 * Security model:
 * - Cache file encrypted with device key (random 256-bit AES-GCM key)
 * - File permissions: 0600 (owner read/write only)
 * - TTL: 15 minutes (configurable via CACHE_TTL_MS)
 * - User isolation: cache path includes UID on Unix systems
 * - Automatic cleanup: expired entries deleted on read
 *
 * @see packages/cli/src/vault/storage.ts for device key management
 * @see packages/cli/src/vault/encryption.ts for crypto operations
 */

import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import envPaths from 'env-paths';
import { encrypt, decrypt } from './encryption.js';
import { getOrCreateDeviceKey } from './storage.js';

/** Cache TTL: 15 minutes in milliseconds */
export const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Encrypted cache entry structure stored on disk.
 */
interface VaultCacheEntry {
  /** Encrypted JWK (JSON Web Key) of the cached CryptoKey */
  encryptedJwk: {
    /** Base64-encoded encrypted JWK */
    ciphertext: string;
    /** Base64-encoded IV for AES-GCM */
    iv: string;
  };
  /** Unix timestamp (ms) when cache expires */
  expiresAt: number;
  /** Unix timestamp (ms) when cache was created */
  createdAt: number;
}

/**
 * Get the path to the vault cache file.
 *
 * Uses platform-specific temp directory with user isolation on Unix:
 * - Linux: /tmp/browserlet/vault-cache-{uid}.enc
 * - macOS: /var/folders/.../T/browserlet/vault-cache-{uid}.enc
 * - Windows: %TEMP%/browserlet/vault-cache.enc
 *
 * @returns Absolute path to cache file
 */
export function getCachePath(): string {
  const paths = envPaths('browserlet', { suffix: '' });

  // Add user ID suffix on non-Windows platforms for multi-user isolation
  let userSuffix = '';
  if (process.platform !== 'win32') {
    try {
      userSuffix = `-${process.getuid!()}`;
    } catch {
      // process.getuid not available (shouldn't happen on Unix, but handle gracefully)
      userSuffix = '';
    }
  }

  return join(paths.temp, `vault-cache${userSuffix}.enc`);
}

/**
 * Get the cached CryptoKey if it exists and hasn't expired.
 *
 * @returns CryptoKey if cache is valid, null if missing/expired/corrupted
 */
export async function getCachedKey(): Promise<CryptoKey | null> {
  const cachePath = getCachePath();

  try {
    // Read cache file
    const content = await readFile(cachePath, 'utf-8');
    const entry: VaultCacheEntry = JSON.parse(content);

    // Check TTL
    if (Date.now() > entry.expiresAt) {
      // Cache expired - delete and return null
      await unlink(cachePath).catch(() => {}); // Ignore errors
      return null;
    }

    // Get device key for decryption
    const deviceKey = await getOrCreateDeviceKey();

    // Decrypt JWK
    const jwkJson = await decrypt(entry.encryptedJwk, deviceKey);
    const jwk: JsonWebKey = JSON.parse(jwkJson);

    // Import CryptoKey from JWK
    const key = await globalThis.crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );

    return key;
  } catch (error: unknown) {
    // Cache file missing, corrupted, or decryption failed
    // Attempt to clean up corrupt cache file
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      await unlink(cachePath).catch(() => {}); // Ignore errors
    }
    return null;
  }
}

/**
 * Cache a CryptoKey by encrypting and storing it in the temp file.
 *
 * @param key - CryptoKey to cache (must be extractable)
 */
export async function setCachedKey(key: CryptoKey): Promise<void> {
  const cachePath = getCachePath();

  // Export CryptoKey to JWK format
  const jwk = await globalThis.crypto.subtle.exportKey('jwk', key);
  const jwkJson = JSON.stringify(jwk);

  // Get device key for encryption
  const deviceKey = await getOrCreateDeviceKey();

  // Encrypt JWK
  const encryptedJwk = await encrypt(jwkJson, deviceKey);

  // Build cache entry with TTL
  const entry: VaultCacheEntry = {
    encryptedJwk,
    expiresAt: Date.now() + CACHE_TTL_MS,
    createdAt: Date.now(),
  };

  // IMPORTANT: Delete old cache file first to ensure mode 0o600 is applied
  // (mode option only applies to newly created files, not existing ones)
  await unlink(cachePath).catch(() => {}); // Ignore ENOENT

  // Ensure temp directory exists
  const cacheDir = dirname(cachePath);
  await mkdir(cacheDir, { recursive: true, mode: 0o700 });

  // Write cache file with secure permissions
  await writeFile(cachePath, JSON.stringify(entry, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

/**
 * Clear the vault cache by deleting the cache file.
 */
export async function clearCache(): Promise<void> {
  const cachePath = getCachePath();
  try {
    await unlink(cachePath);
  } catch (error: unknown) {
    // Ignore ENOENT (cache already cleared or never existed)
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Cleanup expired cache entries (synchronous for CLI startup).
 *
 * This is called during CLI initialization to remove stale cache files
 * without blocking async operations. Uses sync fs operations.
 */
export function cleanupExpiredCache(): void {
  const cachePath = getCachePath();

  try {
    // Read cache file synchronously
    const content = fs.readFileSync(cachePath, 'utf-8');
    const entry: VaultCacheEntry = JSON.parse(content);

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      fs.unlinkSync(cachePath);
    }
  } catch {
    // Ignore all errors (file missing, corrupt, etc.)
    // This is best-effort cleanup during startup
  }
}
