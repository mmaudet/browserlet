/**
 * Password storage utilities.
 *
 * Security model:
 * - When master password is set up: credentials encrypted with PBKDF2-derived key
 * - When no master password: fallback to session key (v1.1 compatibility)
 * - All encryption handled by encryption.ts (encryptApiKey/decryptApiKey)
 *
 * Note: If user saves a credential while vault is locked after master password setup,
 * encryptApiKey will throw "Vault is locked" - this is correct behavior.
 */

import { encryptApiKey, decryptApiKey } from '../crypto/encryption';
import { storage } from '../storage/browserCompat';
import type { StoredPassword } from './types';

const PASSWORDS_KEY = 'browserlet_passwords';

/**
 * Get all stored passwords (encrypted).
 */
export async function getPasswords(): Promise<StoredPassword[]> {
  const data = await storage.local.get(PASSWORDS_KEY);
  return (data[PASSWORDS_KEY] as StoredPassword[] | undefined) ?? [];
}

/**
 * Save a new password or update existing (same url + username).
 */
export async function savePassword(
  url: string,
  username: string,
  password: string,
  alias?: string
): Promise<StoredPassword> {
  const encrypted = await encryptApiKey(password);
  const passwords = await getPasswords();

  // Check for existing entry (same url + username)
  const existing = passwords.find(p => p.url === url && p.username === username);

  if (existing) {
    existing.encryptedPassword = encrypted;
    existing.updatedAt = Date.now();
    // Preserve existing alias unless explicitly provided
    if (alias !== undefined) {
      existing.alias = alias || undefined;
    }
    await storage.local.set({ [PASSWORDS_KEY]: passwords });
    return existing;
  }

  // Create new entry
  const entry: StoredPassword = {
    id: `pwd-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    url,
    username,
    encryptedPassword: encrypted,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Include alias if provided
  if (alias) {
    entry.alias = alias;
  }

  await storage.local.set({ [PASSWORDS_KEY]: [...passwords, entry] });
  return entry;
}

/**
 * Decrypt a password entry.
 */
export async function getDecryptedPassword(entry: StoredPassword): Promise<string> {
  return await decryptApiKey(entry.encryptedPassword);
}

/**
 * Update the alias for an existing password.
 */
export async function updatePasswordAlias(id: string, alias: string | null): Promise<void> {
  const passwords = await getPasswords();
  const credential = passwords.find(p => p.id === id);

  if (!credential) {
    throw new Error(`Credential with id ${id} not found`);
  }

  if (alias) {
    credential.alias = alias;
  } else {
    delete credential.alias;
  }
  credential.updatedAt = Date.now();

  await storage.local.set({ [PASSWORDS_KEY]: passwords });
}

/**
 * Delete a password by ID.
 */
export async function deletePassword(id: string): Promise<void> {
  const passwords = await getPasswords();
  const filtered = passwords.filter(p => p.id !== id);
  await storage.local.set({ [PASSWORDS_KEY]: filtered });
}
