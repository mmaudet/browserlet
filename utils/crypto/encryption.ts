/**
 * AES-GCM encryption utilities for secure API key storage.
 *
 * Security model:
 * - Session key stored in chrome.storage.session (memory-only, cleared on browser restart)
 * - Encrypted API keys stored in chrome.storage.local
 * - Uses Web Crypto API for all cryptographic operations
 */

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
 * The key is stored in chrome.storage.session which is:
 * - Memory-only (not persisted to disk)
 * - Cleared when browser restarts
 * - Only accessible to the extension
 *
 * @returns CryptoKey for AES-GCM encryption/decryption
 */
export async function getOrCreateSessionKey(): Promise<CryptoKey> {
  // Try to get existing key from session storage
  const result = await chrome.storage.session.get(SESSION_KEY_STORAGE_KEY);
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
  await chrome.storage.session.set({ [SESSION_KEY_STORAGE_KEY]: jwk });

  return key;
}

/**
 * Encrypt an API key for secure storage.
 *
 * @param apiKey - The plaintext API key to encrypt
 * @returns EncryptedData with base64-encoded ciphertext and IV
 */
export async function encryptApiKey(apiKey: string): Promise<EncryptedData> {
  const key = await getOrCreateSessionKey();

  // Generate random IV (12 bytes / 96 bits for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encode API key as UTF-8 bytes
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(apiKey);

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    plaintext
  );

  return {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv.buffer),
  };
}

/**
 * Decrypt an API key from encrypted storage.
 *
 * @param data - EncryptedData with base64-encoded ciphertext and IV
 * @returns The decrypted plaintext API key
 * @throws Error if decryption fails (e.g., session key changed after browser restart)
 */
export async function decryptApiKey(data: EncryptedData): Promise<string> {
  const key = await getOrCreateSessionKey();

  // Decode base64 data
  const ciphertext = base64ToBuffer(data.ciphertext);
  const iv = new Uint8Array(base64ToBuffer(data.iv));

  try {
    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    );

    // Decode UTF-8 bytes to string
    const decoder = new TextDecoder();
    return decoder.decode(plaintext);
  } catch (error) {
    throw new Error(
      'Failed to decrypt API key. The session key may have changed after browser restart. ' +
        'Please re-enter your API key.'
    );
  }
}
