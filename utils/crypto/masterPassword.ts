/**
 * Master password key derivation using PBKDF2.
 *
 * Security model:
 * - Master password derives encryption key via PBKDF2 (600k iterations, SHA-256)
 * - Salt stored in chrome.storage.local (unique per installation)
 * - Derived key cached in chrome.storage.session while vault is unlocked
 * - Master password never stored (only used to derive key)
 * - Validation via decryption (not hash comparison)
 */

// Storage keys
const SALT_STORAGE_KEY = 'browserlet_pbkdf2_salt';
const DERIVED_KEY_STORAGE_KEY = 'browserlet_derived_key';
const VALIDATION_STORAGE_KEY = 'browserlet_validation_data';

// Cryptographic constants
const SALT_LENGTH = 16; // 128 bits (NIST recommendation)
const ITERATIONS = 600000; // OWASP 2025/2026 standard
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM

// Known validation plaintext
const VALIDATION_PLAINTEXT = 'browserlet_vault_v1';

/**
 * Validation data structure stored in chrome.storage.local
 */
interface ValidationData {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded initialization vector */
  iv: string;
}

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
 * Get existing salt from chrome.storage.local or generate new 16-byte random salt.
 *
 * The salt is unique per installation and stored as base64 in local storage.
 * Once created, the same salt is used for all future key derivations.
 *
 * @returns 16-byte Uint8Array salt
 */
export async function getOrCreateSalt(): Promise<Uint8Array> {
  const result = await chrome.storage.local.get(SALT_STORAGE_KEY);
  const storedSalt = result[SALT_STORAGE_KEY];

  if (storedSalt) {
    // Convert stored base64 back to Uint8Array
    return new Uint8Array(base64ToBuffer(storedSalt));
  }

  // Generate new random salt
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  // Store as base64 for serialization
  await chrome.storage.local.set({ [SALT_STORAGE_KEY]: bufferToBase64(salt.buffer) });

  return salt;
}

/**
 * Derive an AES-GCM encryption key from master password using PBKDF2.
 *
 * Uses Web Crypto API with:
 * - 600,000 iterations (OWASP 2025/2026 standard)
 * - SHA-256 hash function
 * - 256-bit AES-GCM output key
 *
 * @param password - The master password entered by user
 * @param salt - 16-byte salt from getOrCreateSalt()
 * @returns CryptoKey suitable for AES-GCM encryption/decryption
 */
export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  // Encode password as UTF-8 bytes
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  // Import password as raw key material for PBKDF2
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable: true (needed for caching as JWK)
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Cache the derived key in chrome.storage.session.
 *
 * The key is exported to JWK format for storage. Session storage is:
 * - Memory-only (not persisted to disk)
 * - Cleared when browser restarts
 * - Only accessible to the extension
 *
 * @param key - CryptoKey from deriveKeyFromPassword()
 */
export async function cacheDerivedKey(key: CryptoKey): Promise<void> {
  const jwk = await crypto.subtle.exportKey('jwk', key);
  await chrome.storage.session.set({ [DERIVED_KEY_STORAGE_KEY]: jwk });
}

/**
 * Get the cached derived key from chrome.storage.session.
 *
 * @returns CryptoKey if cached, null if not found (vault locked or browser restarted)
 */
export async function getCachedDerivedKey(): Promise<CryptoKey | null> {
  const result = await chrome.storage.session.get(DERIVED_KEY_STORAGE_KEY);
  const jwk = result[DERIVED_KEY_STORAGE_KEY];

  if (!jwk) {
    return null;
  }

  // Import JWK back to CryptoKey
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * Clear the cached derived key from chrome.storage.session.
 *
 * Call this when locking the vault or on user logout.
 */
export async function clearCachedKey(): Promise<void> {
  await chrome.storage.session.remove(DERIVED_KEY_STORAGE_KEY);
}

/**
 * Create validation data by encrypting a known value.
 *
 * The validation data allows us to verify the master password without
 * storing the password itself. We encrypt a known plaintext and store
 * the ciphertext. Later, we can verify by decrypting and checking the result.
 *
 * @param derivedKey - CryptoKey from deriveKeyFromPassword()
 */
export async function createValidationData(derivedKey: CryptoKey): Promise<void> {
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encode known plaintext
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(VALIDATION_PLAINTEXT);

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    derivedKey,
    plaintext
  );

  // Store validation data
  const validationData: ValidationData = {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv.buffer),
  };

  await chrome.storage.local.set({ [VALIDATION_STORAGE_KEY]: validationData });
}

/**
 * Validate master password by attempting to decrypt validation data.
 *
 * This is the secure way to verify the master password:
 * - Derive key from password
 * - Attempt to decrypt stored validation data
 * - If decryption succeeds and plaintext matches, password is correct
 *
 * @param password - The master password to validate
 * @returns Object with valid flag and derived key (if valid)
 */
export async function validateMasterPassword(
  password: string
): Promise<{ valid: boolean; key: CryptoKey | null }> {
  // Get salt and validation data
  const [salt, validationResult] = await Promise.all([
    getOrCreateSalt(),
    chrome.storage.local.get(VALIDATION_STORAGE_KEY),
  ]);

  const validationData: ValidationData | undefined = validationResult[VALIDATION_STORAGE_KEY];

  if (!validationData) {
    // No validation data means master password not set up yet
    return { valid: false, key: null };
  }

  // Derive key from password
  const derivedKey = await deriveKeyFromPassword(password, salt);

  // Attempt decryption
  try {
    const ciphertext = base64ToBuffer(validationData.ciphertext);
    const iv = new Uint8Array(base64ToBuffer(validationData.iv));

    const plaintext = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      derivedKey,
      ciphertext
    );

    // Decode and verify
    const decoder = new TextDecoder();
    const decrypted = decoder.decode(plaintext);

    if (decrypted === VALIDATION_PLAINTEXT) {
      return { valid: true, key: derivedKey };
    }

    // Decryption succeeded but plaintext wrong (shouldn't happen with AES-GCM)
    return { valid: false, key: null };
  } catch {
    // Decryption failed - wrong password
    return { valid: false, key: null };
  }
}

/**
 * Check if master password has been set up.
 *
 * Returns true if validation data exists (returning user),
 * false if not (first-time setup needed).
 *
 * @returns true if master password was previously configured
 */
export async function hasMasterPasswordSetup(): Promise<boolean> {
  const result = await chrome.storage.local.get(VALIDATION_STORAGE_KEY);
  return result[VALIDATION_STORAGE_KEY] !== undefined;
}
