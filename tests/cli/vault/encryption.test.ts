import { describe, it, expect } from 'vitest';
import {
  deriveKey,
  encrypt,
  decrypt,
  createValidationData,
  verifyMasterPassword,
  generateSalt,
  bufferToBase64,
  base64ToBuffer,
} from '../../../packages/cli/src/vault/encryption.js';

describe('CLI Encryption Module (PBKDF2 + AES-GCM)', () => {
  const testPassword = 'my-secure-password-2024';
  const wrongPassword = 'wrong-password-attempt';

  describe('generateSalt', () => {
    it('returns a 16-byte Uint8Array', () => {
      const salt = generateSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.byteLength).toBe(16);
    });

    it('returns unique salts each call', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(bufferToBase64(salt1.buffer)).not.toBe(bufferToBase64(salt2.buffer));
    });
  });

  describe('bufferToBase64 / base64ToBuffer', () => {
    it('round-trips arbitrary bytes', () => {
      const original = new Uint8Array([0, 1, 127, 128, 255]);
      const base64 = bufferToBase64(original.buffer);
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);
      const restored = new Uint8Array(base64ToBuffer(base64));
      expect(restored).toEqual(original);
    });
  });

  describe('deriveKey', () => {
    it('returns a CryptoKey with AES-GCM algorithm and 256-bit length', async () => {
      const salt = generateSalt();
      const key = await deriveKey(testPassword, salt);
      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect((key.algorithm as AesKeyGenParams).name).toBe('AES-GCM');
      expect((key.algorithm as AesKeyGenParams).length).toBe(256);
      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });

    it('is deterministic: same password + salt produces identical key', async () => {
      const salt = generateSalt();
      const key1 = await deriveKey(testPassword, salt);
      const key2 = await deriveKey(testPassword, salt);
      // Export to JWK to compare key material
      const jwk1 = await globalThis.crypto.subtle.exportKey('jwk', key1);
      const jwk2 = await globalThis.crypto.subtle.exportKey('jwk', key2);
      expect(jwk1.k).toBe(jwk2.k);
    });

    it('different passwords produce different keys', async () => {
      const salt = generateSalt();
      const key1 = await deriveKey(testPassword, salt);
      const key2 = await deriveKey(wrongPassword, salt);
      const jwk1 = await globalThis.crypto.subtle.exportKey('jwk', key1);
      const jwk2 = await globalThis.crypto.subtle.exportKey('jwk', key2);
      expect(jwk1.k).not.toBe(jwk2.k);
    });
  });

  describe('encrypt / decrypt', () => {
    it('encrypt returns { ciphertext, iv } with non-empty base64 values', async () => {
      const salt = generateSalt();
      const key = await deriveKey(testPassword, salt);
      const result = await encrypt('hello world', key);
      expect(result).toHaveProperty('ciphertext');
      expect(result).toHaveProperty('iv');
      expect(typeof result.ciphertext).toBe('string');
      expect(typeof result.iv).toBe('string');
      expect(result.ciphertext.length).toBeGreaterThan(0);
      expect(result.iv.length).toBeGreaterThan(0);
    });

    it('decrypt returns original plaintext', async () => {
      const salt = generateSalt();
      const key = await deriveKey(testPassword, salt);
      const plaintext = 'The quick brown fox jumps over the lazy dog!';
      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('decrypt with wrong key throws error', async () => {
      const salt = generateSalt();
      const key = await deriveKey(testPassword, salt);
      const wrongKey = await deriveKey(wrongPassword, salt);
      const encrypted = await encrypt('secret data', key);
      await expect(decrypt(encrypted, wrongKey)).rejects.toThrow();
    });

    it('encrypt produces different ciphertext each call (random IV)', async () => {
      const salt = generateSalt();
      const key = await deriveKey(testPassword, salt);
      const plaintext = 'same input';
      const result1 = await encrypt(plaintext, key);
      const result2 = await encrypt(plaintext, key);
      expect(result1.ciphertext).not.toBe(result2.ciphertext);
      expect(result1.iv).not.toBe(result2.iv);
    });

    it('round-trips empty string', async () => {
      const salt = generateSalt();
      const key = await deriveKey(testPassword, salt);
      const encrypted = await encrypt('', key);
      const decrypted = await decrypt(encrypted, key);
      expect(decrypted).toBe('');
    });

    it('round-trips unicode text', async () => {
      const salt = generateSalt();
      const key = await deriveKey(testPassword, salt);
      const plaintext = 'Mot de passe securise avec accents et emojis';
      const encrypted = await encrypt(plaintext, key);
      const decrypted = await decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('createValidationData', () => {
    it('returns { ciphertext, iv } for known plaintext', async () => {
      const salt = generateSalt();
      const key = await deriveKey(testPassword, salt);
      const validationData = await createValidationData(key);
      expect(validationData).toHaveProperty('ciphertext');
      expect(validationData).toHaveProperty('iv');
      expect(typeof validationData.ciphertext).toBe('string');
      expect(typeof validationData.iv).toBe('string');
    });
  });

  describe('verifyMasterPassword', () => {
    it('returns { valid: true, key } for correct password', async () => {
      const salt = generateSalt();
      const key = await deriveKey(testPassword, salt);
      const validationData = await createValidationData(key);
      const result = await verifyMasterPassword(testPassword, salt, validationData);
      expect(result.valid).toBe(true);
      expect(result.key).toBeDefined();
      expect(result.key).not.toBeNull();
      expect(result.key!.type).toBe('secret');
    });

    it('returns { valid: false, key: null } for wrong password', async () => {
      const salt = generateSalt();
      const key = await deriveKey(testPassword, salt);
      const validationData = await createValidationData(key);
      const result = await verifyMasterPassword(wrongPassword, salt, validationData);
      expect(result.valid).toBe(false);
      expect(result.key).toBeNull();
    });
  });
});
