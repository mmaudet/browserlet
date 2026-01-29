import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encryptApiKey, decryptApiKey, getOrCreateSessionKey, EncryptedData } from '@/utils/crypto/encryption';

// Mock chrome.storage.session
const mockSessionStorage = new Map<string, unknown>();

vi.stubGlobal('chrome', {
  storage: {
    session: {
      get: vi.fn((key: string) => {
        return Promise.resolve({ [key]: mockSessionStorage.get(key) });
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(items)) {
          mockSessionStorage.set(key, value);
        }
        return Promise.resolve();
      }),
    },
  },
});

describe('encryption utilities', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreateSessionKey', () => {
    it('creates a new key when none exists', async () => {
      const key = await getOrCreateSessionKey();

      expect(key).toBeDefined();
      expect(key.type).toBe('secret');
      expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
      expect(key.usages).toContain('encrypt');
      expect(key.usages).toContain('decrypt');
    });

    it('returns the same key on subsequent calls', async () => {
      const key1 = await getOrCreateSessionKey();
      const key2 = await getOrCreateSessionKey();

      // Export both keys and compare
      const jwk1 = await crypto.subtle.exportKey('jwk', key1);
      const jwk2 = await crypto.subtle.exportKey('jwk', key2);

      expect(jwk1.k).toBe(jwk2.k);
    });
  });

  describe('encryptApiKey', () => {
    it('returns encrypted data with ciphertext and iv', async () => {
      const result = await encryptApiKey('test-api-key-123');

      expect(result).toHaveProperty('ciphertext');
      expect(result).toHaveProperty('iv');
      expect(typeof result.ciphertext).toBe('string');
      expect(typeof result.iv).toBe('string');
      expect(result.ciphertext.length).toBeGreaterThan(0);
      expect(result.iv.length).toBeGreaterThan(0);
    });

    it('produces different ciphertext for same input (due to random IV)', async () => {
      const result1 = await encryptApiKey('same-key');
      const result2 = await encryptApiKey('same-key');

      // IVs should be different
      expect(result1.iv).not.toBe(result2.iv);
      // Ciphertexts should be different
      expect(result1.ciphertext).not.toBe(result2.ciphertext);
    });
  });

  describe('decryptApiKey', () => {
    it('decrypts to original value (round-trip)', async () => {
      const original = 'sk-ant-api03-xxxxxxxxxxxxx';

      const encrypted = await encryptApiKey(original);
      const decrypted = await decryptApiKey(encrypted);

      expect(decrypted).toBe(original);
    });

    it('handles special characters correctly', async () => {
      const original = 'key-with-special-chars!@#$%^&*()';

      const encrypted = await encryptApiKey(original);
      const decrypted = await decryptApiKey(encrypted);

      expect(decrypted).toBe(original);
    });

    it('handles unicode characters correctly', async () => {
      const original = 'key-with-unicode-chars-';

      const encrypted = await encryptApiKey(original);
      const decrypted = await decryptApiKey(encrypted);

      expect(decrypted).toBe(original);
    });

    it('handles empty string', async () => {
      const original = '';

      const encrypted = await encryptApiKey(original);
      const decrypted = await decryptApiKey(encrypted);

      expect(decrypted).toBe(original);
    });

    it('throws error for tampered ciphertext', async () => {
      const encrypted = await encryptApiKey('test-key');

      // Tamper with ciphertext
      const tampered: EncryptedData = {
        ...encrypted,
        ciphertext: 'invalidbase64data' + encrypted.ciphertext.slice(20),
      };

      await expect(decryptApiKey(tampered)).rejects.toThrow();
    });
  });

  describe('encryption security properties', () => {
    it('ciphertext is different from plaintext', async () => {
      const original = 'my-secret-api-key';
      const encrypted = await encryptApiKey(original);

      // Decode base64 to check it's not just encoded plaintext
      const decoded = atob(encrypted.ciphertext);
      expect(decoded).not.toContain(original);
    });
  });
});
