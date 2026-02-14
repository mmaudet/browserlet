/**
 * CLI encryption module using Web Crypto API (globalThis.crypto.subtle).
 *
 * Byte-compatible with the extension's crypto implementation:
 * - PBKDF2: 600,000 iterations, SHA-256, 16-byte salt
 * - AES-GCM: 256-bit key, 12-byte IV
 * - Validation: encrypt known plaintext "browserlet_vault_v1", verify by decryption
 * - Base64 encoding using Node.js Buffer (compatible with extension's btoa/atob)
 *
 * @see utils/crypto/masterPassword.ts (extension implementation)
 * @see utils/crypto/encryption.ts (extension implementation)
 */

// Cryptographic constants - MUST match extension exactly
const SALT_LENGTH = 16; // 128 bits (NIST recommendation)
const ITERATIONS = 600000; // OWASP 2025/2026 standard
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for AES-GCM
const VALIDATION_PLAINTEXT = 'browserlet_vault_v1';

/**
 * Encrypted data structure (matches extension's EncryptedData / ValidationData)
 */
export interface EncryptedData {
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded initialization vector */
  iv: string;
}

/**
 * Convert ArrayBuffer to base64 string.
 *
 * Uses Node.js Buffer which produces identical base64 output to the extension's
 * btoa(String.fromCharCode(...bytes)) approach.
 */
export function bufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('base64');
}

/**
 * Convert base64 string to ArrayBuffer.
 *
 * Uses Node.js Buffer which produces identical bytes to the extension's
 * atob() + charCodeAt() approach.
 */
export function base64ToBuffer(base64: string): ArrayBuffer {
  const buf = Buffer.from(base64, 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

/**
 * Generate a random 16-byte salt.
 *
 * @returns 16-byte Uint8Array salt
 */
export function generateSalt(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Derive an AES-GCM encryption key from password using PBKDF2.
 *
 * Parameters match extension exactly:
 * - 600,000 iterations (OWASP 2025/2026 standard)
 * - SHA-256 hash function
 * - 256-bit AES-GCM output key
 *
 * @param password - The master password
 * @param salt - 16-byte salt
 * @returns CryptoKey suitable for AES-GCM encryption/decryption
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  // Import password as raw key material for PBKDF2
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  const derivedKey = await globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    true, // extractable: true (needed for JWK export and comparison)
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Encrypt plaintext using AES-GCM with a random IV.
 *
 * @param plaintext - The string to encrypt
 * @param key - CryptoKey for AES-GCM encryption
 * @returns EncryptedData with base64-encoded ciphertext and IV
 */
export async function encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedData> {
  // Generate random IV (12 bytes / 96 bits for AES-GCM)
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encode plaintext as UTF-8 bytes
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // Encrypt
  const ciphertext = await globalThis.crypto.subtle.encrypt(
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
 * Decrypt data using AES-GCM.
 *
 * @param data - EncryptedData with base64-encoded ciphertext and IV
 * @param key - CryptoKey for AES-GCM decryption
 * @returns The decrypted plaintext string
 * @throws Error if decryption fails (wrong key, corrupted data)
 */
export async function decrypt(data: EncryptedData, key: CryptoKey): Promise<string> {
  const ciphertext = base64ToBuffer(data.ciphertext);
  const iv = new Uint8Array(base64ToBuffer(data.iv));

  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

/**
 * Create validation data by encrypting a known plaintext.
 *
 * Used to verify the master password without storing it.
 * The known plaintext "browserlet_vault_v1" is encrypted and stored.
 * Later, verifyMasterPassword() decrypts and checks the result.
 *
 * @param key - CryptoKey from deriveKey()
 * @returns EncryptedData containing the encrypted validation plaintext
 */
export async function createValidationData(key: CryptoKey): Promise<EncryptedData> {
  return encrypt(VALIDATION_PLAINTEXT, key);
}

/**
 * Verify a master password by attempting to decrypt validation data.
 *
 * Derives a key from the password and salt, then tries to decrypt
 * the stored validation data. If decryption succeeds and the result
 * matches the known plaintext, the password is correct.
 *
 * @param password - The master password to verify
 * @param salt - The salt used when the password was originally set
 * @param validationData - Encrypted validation data from createValidationData()
 * @returns { valid: true, key } if correct, { valid: false, key: null } if wrong
 */
export async function verifyMasterPassword(
  password: string,
  salt: Uint8Array,
  validationData: EncryptedData
): Promise<{ valid: boolean; key: CryptoKey | null }> {
  const derivedKey = await deriveKey(password, salt);

  try {
    const decrypted = await decrypt(validationData, derivedKey);

    if (decrypted === VALIDATION_PLAINTEXT) {
      return { valid: true, key: derivedKey };
    }

    // Decryption succeeded but plaintext wrong (shouldn't happen with AES-GCM)
    return { valid: false, key: null };
  } catch {
    // Decryption failed - wrong password (AES-GCM authentication tag mismatch)
    return { valid: false, key: null };
  }
}
