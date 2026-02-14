import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Mock env-paths to use a temp directory for each test
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

// Import AFTER mock setup so the mock is applied
import {
  getVaultPath,
  vaultExists,
  initializeVault,
  readVault,
  writeVault,
  addCredential,
  getCredential,
  deleteCredential,
} from '../../../packages/cli/src/vault/storage.js';
import type { VaultData } from '../../../packages/cli/src/vault/storage.js';

describe('Vault File Storage', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'browserlet-vault-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const testSalt = 'dGVzdHNhbHQxMjM0NTY3OA=='; // base64-encoded test salt
  const testValidationData = {
    ciphertext: 'dGVzdGNpcGhlcnRleHQ=',
    iv: 'dGVzdGl2MTIzNA==',
  };

  describe('getVaultPath', () => {
    it('returns path ending with vault.json inside config directory', () => {
      const path = getVaultPath();
      expect(path).toBe(join(tempDir, 'vault.json'));
    });
  });

  describe('vaultExists', () => {
    it('returns false before initialization', async () => {
      expect(await vaultExists()).toBe(false);
    });

    it('returns true after initialization', async () => {
      await initializeVault(testSalt, testValidationData);
      expect(await vaultExists()).toBe(true);
    });
  });

  describe('initializeVault', () => {
    it('creates vault file with correct structure', async () => {
      await initializeVault(testSalt, testValidationData);

      const vault = await readVault();
      expect(vault.salt).toBe(testSalt);
      expect(vault.validationData).toEqual(testValidationData);
      expect(vault.credentials).toEqual([]);
    });

    it('creates vault file with 0600 permissions on non-Windows', async () => {
      if (process.platform === 'win32') return;

      await initializeVault(testSalt, testValidationData);

      const vaultPath = getVaultPath();
      const fileStat = await stat(vaultPath);
      // mode includes file type bits; mask with 0o777 to get permission bits
      const permBits = fileStat.mode & 0o777;
      expect(permBits).toBe(0o600);
    });

    it('creates config directory with 0700 permissions on non-Windows', async () => {
      if (process.platform === 'win32') return;

      // Use a nested directory to test recursive creation
      const originalTempDir = tempDir;
      tempDir = join(originalTempDir, 'nested', 'config');

      await initializeVault(testSalt, testValidationData);

      const dirStat = await stat(tempDir);
      const permBits = dirStat.mode & 0o777;
      expect(permBits).toBe(0o700);

      // Restore for cleanup
      tempDir = originalTempDir;
    });
  });

  describe('readVault / writeVault', () => {
    it('round-trips vault data', async () => {
      await initializeVault(testSalt, testValidationData);

      const vault = await readVault();
      vault.credentials.push({
        id: 'cred-test-001',
        alias: 'myalias',
        encryptedValue: { ciphertext: 'abc', iv: 'def' },
        createdAt: 1000,
        updatedAt: 1000,
      });

      await writeVault(vault);
      const reread = await readVault();
      expect(reread.credentials).toHaveLength(1);
      expect(reread.credentials[0].alias).toBe('myalias');
    });

    it('writeVault preserves 0600 permissions on non-Windows', async () => {
      if (process.platform === 'win32') return;

      await initializeVault(testSalt, testValidationData);
      const vault = await readVault();
      await writeVault(vault);

      const fileStat = await stat(getVaultPath());
      const permBits = fileStat.mode & 0o777;
      expect(permBits).toBe(0o600);
    });
  });

  describe('addCredential', () => {
    beforeEach(async () => {
      await initializeVault(testSalt, testValidationData);
    });

    it('returns a unique id with cred- prefix', async () => {
      const id = await addCredential('test-cred', {
        ciphertext: 'enc1',
        iv: 'iv1',
      });
      expect(id).toMatch(/^cred-\d+-[0-9a-f]{8}$/);
    });

    it('credential appears in readVault after add', async () => {
      const id = await addCredential('login-pwd', {
        ciphertext: 'enc2',
        iv: 'iv2',
      });

      const vault = await readVault();
      expect(vault.credentials).toHaveLength(1);
      expect(vault.credentials[0].id).toBe(id);
      expect(vault.credentials[0].alias).toBe('login-pwd');
      expect(vault.credentials[0].encryptedValue).toEqual({
        ciphertext: 'enc2',
        iv: 'iv2',
      });
    });

    it('generates unique ids for multiple credentials', async () => {
      const id1 = await addCredential('first', {
        ciphertext: 'a',
        iv: 'b',
      });
      const id2 = await addCredential('second', {
        ciphertext: 'c',
        iv: 'd',
      });
      expect(id1).not.toBe(id2);

      const vault = await readVault();
      expect(vault.credentials).toHaveLength(2);
    });

    it('handles undefined alias', async () => {
      const id = await addCredential(undefined, {
        ciphertext: 'enc3',
        iv: 'iv3',
      });

      const vault = await readVault();
      const cred = vault.credentials.find((c) => c.id === id);
      expect(cred).toBeDefined();
      expect(cred!.alias).toBeUndefined();
    });
  });

  describe('getCredential', () => {
    beforeEach(async () => {
      await initializeVault(testSalt, testValidationData);
    });

    it('finds credential by alias', async () => {
      await addCredential('github-token', {
        ciphertext: 'ghenc',
        iv: 'ghiv',
      });

      const found = await getCredential('github-token');
      expect(found).not.toBeNull();
      expect(found!.alias).toBe('github-token');
    });

    it('finds credential by id', async () => {
      const id = await addCredential('some-alias', {
        ciphertext: 'x',
        iv: 'y',
      });

      const found = await getCredential(id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(id);
    });

    it('returns null for unknown credential', async () => {
      const found = await getCredential('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('deleteCredential', () => {
    beforeEach(async () => {
      await initializeVault(testSalt, testValidationData);
    });

    it('removes credential by id and returns true', async () => {
      const id = await addCredential('to-delete', {
        ciphertext: 'del',
        iv: 'del',
      });
      expect(await deleteCredential(id)).toBe(true);

      const vault = await readVault();
      expect(vault.credentials).toHaveLength(0);
    });

    it('returns false for nonexistent id', async () => {
      expect(await deleteCredential('cred-fake-12345678')).toBe(false);
    });

    it('only removes the targeted credential', async () => {
      const id1 = await addCredential('keep', {
        ciphertext: 'a',
        iv: 'b',
      });
      const id2 = await addCredential('remove', {
        ciphertext: 'c',
        iv: 'd',
      });

      await deleteCredential(id2);

      const vault = await readVault();
      expect(vault.credentials).toHaveLength(1);
      expect(vault.credentials[0].id).toBe(id1);
    });
  });
});
