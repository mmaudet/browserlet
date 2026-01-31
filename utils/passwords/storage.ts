import { encryptApiKey, decryptApiKey } from '../crypto/encryption';
import type { StoredPassword } from './types';

const PASSWORDS_KEY = 'browserlet_passwords';

/**
 * Get all stored passwords (encrypted).
 */
export async function getPasswords(): Promise<StoredPassword[]> {
  const data = await chrome.storage.local.get(PASSWORDS_KEY);
  return (data[PASSWORDS_KEY] as StoredPassword[] | undefined) ?? [];
}

/**
 * Save a new password or update existing (same url + username).
 */
export async function savePassword(
  url: string,
  username: string,
  password: string
): Promise<StoredPassword> {
  const encrypted = await encryptApiKey(password);
  const passwords = await getPasswords();

  // Check for existing entry (same url + username)
  const existing = passwords.find(p => p.url === url && p.username === username);

  if (existing) {
    existing.encryptedPassword = encrypted;
    existing.updatedAt = Date.now();
    await chrome.storage.local.set({ [PASSWORDS_KEY]: passwords });
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

  await chrome.storage.local.set({ [PASSWORDS_KEY]: [...passwords, entry] });
  return entry;
}

/**
 * Decrypt a password entry.
 */
export async function getDecryptedPassword(entry: StoredPassword): Promise<string> {
  return await decryptApiKey(entry.encryptedPassword);
}

/**
 * Delete a password by ID.
 */
export async function deletePassword(id: string): Promise<void> {
  const passwords = await getPasswords();
  const filtered = passwords.filter(p => p.id !== id);
  await chrome.storage.local.set({ [PASSWORDS_KEY]: filtered });
}
