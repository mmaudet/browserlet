/**
 * AES-GCM encryption utilities for secure API key storage.
 *
 * Security model:
 * - When master password is set up: credentials encrypted with PBKDF2-derived key (persistent)
 * - When no master password: fallback to session key (v1.1 compatibility, lost on browser restart)
 * - Encrypted data stored in chrome.storage.local
 * - Uses Web Crypto API for all cryptographic operations
 */

import { hasMasterPasswordSetup, getCachedDerivedKey } from './masterPassword';
import { storage } from '../storage/browserCompat';

/**
 * Encrypted data structure for storage
 */
export interface EncryptedData {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded initialization vector */
  iv: string;
}

const SESSION_KEY_STORAGE_KEY = 'browserlet_session_key';
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM

/**
 * Convert ArrayBuffer to base64 string
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string to ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Get or create the session encryption key.
 *
 * The key is stored in storage.session which is:
 * - Memory-only (not persisted to disk)
 * - Cleared when browser restarts
 * - Only accessible to the extension
 *
 * @returns CryptoKey for AES-GCM encryption/decryption
 */
export async function getOrCreateSessionKey(): Promise<CryptoKey> {
  // Try to get existing key from session storage
  const result = await storage.session.get(SESSION_KEY_STORAGE_KEY);
  const storedKey = result[SESSION_KEY_STORAGE_KEY];

  if (storedKey) {
    // Import existing key from JWK format
    return crypto.subtle.importKey(
      'jwk',
      storedKey,
      { name: ALGORITHM, length: KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Generate new key
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );

  // Export and store as JWK
  const jwk = await crypto.subtle.exportKey('jwk', key);
  await storage.session.set({ [SESSION_KEY_STORAGE_KEY]: jwk });

  return key;
}

/**
 * Encrypt plaintext using a provided CryptoKey.
 *
 * This is the core encryption function that can be used with any AES-GCM key,
 * including session keys and master password-derived keys.
 *
 * @param plaintext - The plaintext string to encrypt
 * @param key - CryptoKey for AES-GCM encryption
 * @returns EncryptedData with base64-encoded ciphertext and IV
 */
export async function encryptWithKey(plaintext: string, key: CryptoKey): Promise<EncryptedData> {
  // Generate random IV (12 bytes / 96 bits for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encode plaintext as UTF-8 bytes
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    plaintextBytes
  );

  return {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv.buffer),
  };
}

/**
 * Decrypt data using a provided CryptoKey.
 *
 * This is the core decryption function that can be used with any AES-GCM key,
 * including session keys and master password-derived keys.
 *
 * @param data - EncryptedData with base64-encoded ciphertext and IV
 * @param key - CryptoKey for AES-GCM decryption
 * @returns The decrypted plaintext string
 * @throws Error if decryption fails (e.g., wrong key)
 */
export async function decryptWithKey(data: EncryptedData, key: CryptoKey): Promise<string> {
  // Decode base64 data
  const ciphertext = base64ToBuffer(data.ciphertext);
  const iv = new Uint8Array(base64ToBuffer(data.iv));

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  // Decode UTF-8 bytes to string
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

/**
 * Encrypt an API key for secure storage.
 *
 * Key selection:
 * - If master password is set up: Uses PBKDF2-derived key (requires vault unlocked)
 * - If no master password: Uses session key (backward compatibility, v1.1)
 *
 * The session key path is for backward compatibility during migration period.
 * New users should set up a master password for persistent credential storage.
 *
 * @param apiKey - The plaintext API key to encrypt
 * @returns EncryptedData with base64-encoded ciphertext and IV
 * @throws Error if master password is set up but vault is locked
 */
export async function encryptApiKey(apiKey: string): Promise<EncryptedData> {
  // Check if master password system is set up
  const hasMasterPassword = await hasMasterPasswordSetup();

  if (hasMasterPassword) {
    // Post-migration: Use master password-derived key
    const key = await getCachedDerivedKey();
    if (!key) {
      throw new Error('Vault is locked. Unlock vault to save credentials.');
    }
    return encryptWithKey(apiKey, key);
  }

  // Pre-migration fallback: Use session key (backward compat)
  const sessionKey = await getOrCreateSessionKey();
  return encryptWithKey(apiKey, sessionKey);
}

/**
 * Decrypt an API key from encrypted storage.
 *
 * Key selection:
 * - If master password is set up: Uses PBKDF2-derived key (requires vault unlocked)
 * - If no master password: Uses session key (backward compatibility, v1.1)
 *
 * The session key path is for backward compatibility during migration period.
 * Credentials encrypted with session key will fail after browser restart.
 *
 * @param data - EncryptedData with base64-encoded ciphertext and IV
 * @returns The decrypted plaintext API key
 * @throws Error if vault is locked or decryption fails
 */
export async function decryptApiKey(data: EncryptedData): Promise<string> {
  const hasMasterPassword = await hasMasterPasswordSetup();

  if (hasMasterPassword) {
    // Post-migration: Use master password-derived key
    const key = await getCachedDerivedKey();
    if (!key) {
      throw new Error('Vault is locked. Unlock vault to access credentials.');
    }
    try {
      return await decryptWithKey(data, key);
    } catch (error) {
      throw new Error(
        'Failed to decrypt credential. The credential may have been encrypted with a different key.'
      );
    }
  }

  // Pre-migration fallback: Use session key
  const sessionKey = await getOrCreateSessionKey();
  try {
    return await decryptWithKey(data, sessionKey);
  } catch (error) {
    throw new Error(
      'Failed to decrypt. The session key may have changed after browser restart. ' +
        'Please set up a master password to enable persistent credentials.'
    );
  }
}
