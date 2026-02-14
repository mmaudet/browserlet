import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Mock env-paths to use a temp directory
let tempDir: string;

vi.mock('env-paths', () => ({
  default: () => ({
    config: tempDir,
    data: tempDir,
    cache: tempDir,
    log: tempDir,
    temp: tempDir,
  }),
}));

import { CLIPasswordStorage } from '../../../packages/cli/src/credentials/resolver.js';
import {
  initializeVault,
  addCredential,
} from '../../../packages/cli/src/vault/storage.js';
import {
  deriveKey,
  generateSalt,
  encrypt,
  bufferToBase64,
  createValidationData,
} from '../../../packages/cli/src/vault/encryption.js';
import { substituteCredentials } from '../../../packages/core/src/substitution/credentials.js';

describe('CLIPasswordStorage', () => {
  let derivedKey: CryptoKey;
  let salt: Uint8Array;

  const testPassword = 'test-master-password';

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'browserlet-resolver-test-'));
    salt = generateSalt();
    derivedKey = await deriveKey(testPassword, salt);
    const validationData = await createValidationData(derivedKey);
    await initializeVault(bufferToBase64(salt.buffer), validationData);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('getPasswords', () => {
    it('returns empty array when no credentials stored', async () => {
      const storage = new CLIPasswordStorage(derivedKey);
      const passwords = await storage.getPasswords();
      expect(passwords).toEqual([]);
    });

    it('returns correct StoredPasswordRef for each credential', async () => {
      const encVal1 = await encrypt('secret1', derivedKey);
      const encVal2 = await encrypt('secret2', derivedKey);

      const id1 = await addCredential('github-token', encVal1);
      const id2 = await addCredential('db-password', encVal2);

      const storage = new CLIPasswordStorage(derivedKey);
      const passwords = await storage.getPasswords();

      expect(passwords).toHaveLength(2);
      expect(passwords).toContainEqual({ id: id1, alias: 'github-token' });
      expect(passwords).toContainEqual({ id: id2, alias: 'db-password' });
    });

    it('omits alias when credential has no alias', async () => {
      const encVal = await encrypt('noalias-secret', derivedKey);
      const id = await addCredential(undefined, encVal);

      const storage = new CLIPasswordStorage(derivedKey);
      const passwords = await storage.getPasswords();

      expect(passwords).toHaveLength(1);
      expect(passwords[0].id).toBe(id);
      expect(passwords[0].alias).toBeUndefined();
    });
  });

  describe('decryptPassword', () => {
    it('returns decrypted value for valid credential', async () => {
      const plaintext = 'my-super-secret-api-key';
      const encVal = await encrypt(plaintext, derivedKey);
      const id = await addCredential('api-key', encVal);

      const storage = new CLIPasswordStorage(derivedKey);
      const decrypted = await storage.decryptPassword({ id, alias: 'api-key' });

      expect(decrypted).toBe(plaintext);
    });

    it('throws for unknown credential', async () => {
      const storage = new CLIPasswordStorage(derivedKey);

      await expect(
        storage.decryptPassword({ id: 'cred-nonexistent-00000000' })
      ).rejects.toThrow('Credential not found in vault');
    });

    it('decrypts credential found by id (not alias)', async () => {
      const plaintext = 'password-by-id';
      const encVal = await encrypt(plaintext, derivedKey);
      const id = await addCredential('some-alias', encVal);

      const storage = new CLIPasswordStorage(derivedKey);
      const decrypted = await storage.decryptPassword({ id });

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('integration with substituteCredentials from @browserlet/core', () => {
    it('resolves {{credential:alias}} references using CLIPasswordStorage', async () => {
      const encVal = await encrypt('s3cretValue!', derivedKey);
      await addCredential('test-pwd', encVal);

      const storage = new CLIPasswordStorage(derivedKey);
      const result = await substituteCredentials(
        'fill {{credential:test-pwd}} into field',
        storage
      );

      expect(result).toBe('fill s3cretValue! into field');
    });

    it('resolves multiple credentials in one text', async () => {
      const encUser = await encrypt('admin', derivedKey);
      const encPass = await encrypt('p@ss123', derivedKey);
      await addCredential('username', encUser);
      await addCredential('password', encPass);

      const storage = new CLIPasswordStorage(derivedKey);
      const result = await substituteCredentials(
        'login {{credential:username}} with {{credential:password}}',
        storage
      );

      expect(result).toBe('login admin with p@ss123');
    });

    it('throws when credential not found during substitution', async () => {
      const storage = new CLIPasswordStorage(derivedKey);

      await expect(
        substituteCredentials('fill {{credential:missing}}', storage)
      ).rejects.toThrow('Credential not found: "missing"');
    });

    it('returns text unchanged when no credential references present', async () => {
      const storage = new CLIPasswordStorage(derivedKey);
      const result = await substituteCredentials('no credentials here', storage);
      expect(result).toBe('no credentials here');
    });
  });
});
