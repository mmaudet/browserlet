/**
 * File-based vault storage for CLI credentials.
 *
 * Stores encrypted credentials in ~/.browserlet/vault.json (cross-platform via env-paths).
 * File permissions: 0600 (owner read/write only).
 * Directory permissions: 0700 (owner access only).
 *
 * @see packages/cli/src/vault/encryption.ts for encryption operations
 */

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname } from 'node:path';
import { join } from 'node:path';
import envPaths from 'env-paths';

/**
 * A single encrypted credential stored in the vault.
 */
export interface VaultCredential {
  /** Unique identifier: "cred-{timestamp}-{hex}" */
  id: string;
  /** User-friendly name for {{credential:alias}} references */
  alias?: string;
  /** URL associated with this credential */
  url?: string;
  /** Username / login for this credential */
  username?: string;
  /** Number of BSL scripts referencing this credential */
  usedInScripts?: number;
  /** AES-GCM encrypted credential value */
  encryptedValue: { ciphertext: string; iv: string };
  /** Unix timestamp (ms) when credential was created */
  createdAt: number;
  /** Unix timestamp (ms) when credential was last updated */
  updatedAt: number;
}

/**
 * Top-level vault file structure (vault.json).
 */
export interface VaultData {
  /** Base64-encoded 16-byte salt for PBKDF2 key derivation */
  salt: string;
  /** Encrypted known plaintext for master password verification */
  validationData: { ciphertext: string; iv: string };
  /** Array of encrypted credentials */
  credentials: VaultCredential[];
}

/**
 * Get the path to the vault.json file.
 *
 * Uses env-paths for cross-platform config directory:
 * - Linux: ~/.config/browserlet/vault.json
 * - macOS: ~/Library/Preferences/browserlet/vault.json
 * - Windows: %APPDATA%/browserlet/Config/vault.json
 */
export function getVaultPath(): string {
  const paths = envPaths('browserlet', { suffix: '' });
  return join(paths.config, 'vault.json');
}

/**
 * Check if the vault file exists.
 *
 * @returns true if vault.json exists and is accessible
 */
export async function vaultExists(): Promise<boolean> {
  try {
    await access(getVaultPath());
    return true;
  } catch {
    return false;
  }
}

/**
 * Initialize a new vault file with secure permissions.
 *
 * Creates the config directory with mode 0700 and writes vault.json with mode 0600.
 * The vault starts with an empty credentials array.
 *
 * @param salt - Base64-encoded 16-byte salt for PBKDF2
 * @param validationData - Encrypted known plaintext for password verification
 */
export async function initializeVault(
  salt: string,
  validationData: { ciphertext: string; iv: string }
): Promise<void> {
  const vaultPath = getVaultPath();
  const vaultDir = dirname(vaultPath);

  // Create directory with owner-only access (0700)
  await mkdir(vaultDir, { recursive: true, mode: 0o700 });

  const data: VaultData = {
    salt,
    validationData,
    credentials: [],
  };

  // Write vault file with owner read/write only (0600)
  await writeFile(vaultPath, JSON.stringify(data, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

/**
 * Read and parse the vault file.
 *
 * @returns Parsed VaultData
 * @throws Error if vault file doesn't exist or contains invalid JSON
 */
export async function readVault(): Promise<VaultData> {
  const vaultPath = getVaultPath();
  const content = await readFile(vaultPath, 'utf-8');
  return JSON.parse(content) as VaultData;
}

/**
 * Write vault data to the vault file with secure permissions.
 *
 * @param data - VaultData to write
 */
export async function writeVault(data: VaultData): Promise<void> {
  const vaultPath = getVaultPath();
  await writeFile(vaultPath, JSON.stringify(data, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

/**
 * Add a new credential to the vault.
 *
 * Generates a unique ID in the format "cred-{timestamp}-{randomHex}".
 *
 * @param alias - User-friendly name for {{credential:alias}} references (optional)
 * @param encryptedValue - AES-GCM encrypted credential value
 * @returns The generated credential ID
 */
export async function addCredential(
  alias: string | undefined,
  encryptedValue: { ciphertext: string; iv: string }
): Promise<string> {
  const vault = await readVault();

  const id = `cred-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const now = Date.now();

  const credential: VaultCredential = {
    id,
    ...(alias !== undefined ? { alias } : {}),
    encryptedValue,
    createdAt: now,
    updatedAt: now,
  };

  vault.credentials.push(credential);
  await writeVault(vault);

  return id;
}

/**
 * Find a credential by ID or alias.
 *
 * @param idOrAlias - Credential ID or alias to search for
 * @returns The matching VaultCredential, or null if not found
 */
export async function getCredential(
  idOrAlias: string
): Promise<VaultCredential | null> {
  const vault = await readVault();
  const found = vault.credentials.find(
    (c) => c.id === idOrAlias || c.alias === idOrAlias
  );
  return found ?? null;
}

/**
 * Delete a credential by ID.
 *
 * @param id - Credential ID to delete
 * @returns true if the credential was found and removed, false otherwise
 */
export async function deleteCredential(id: string): Promise<boolean> {
  const vault = await readVault();
  const index = vault.credentials.findIndex((c) => c.id === id);

  if (index === -1) {
    return false;
  }

  vault.credentials.splice(index, 1);
  await writeVault(vault);
  return true;
}
