/**
 * CLIPasswordStorage adapter for @browserlet/core credential substitution.
 *
 * Implements the PasswordStorage interface so that substituteCredentials()
 * from @browserlet/core can resolve {{credential:name}} references using
 * the CLI's file-based encrypted vault.
 *
 * @see packages/core/src/substitution/credentials.ts for the interface
 * @see packages/cli/src/vault/storage.ts for vault CRUD
 * @see packages/cli/src/vault/encryption.ts for decrypt()
 */

import type { PasswordStorage, StoredPasswordRef } from '@browserlet/core/substitution';
import { readVault, getCredential } from '../vault/storage.js';
import { decrypt } from '../vault/encryption.js';

/**
 * CLI adapter for credential storage using the local encrypted vault.
 *
 * Bridges @browserlet/core's credential substitution with the CLI vault.
 * Requires an unlocked master password key (CryptoKey) to decrypt credentials.
 *
 * @example
 * ```ts
 * const storage = new CLIPasswordStorage(derivedKey);
 * const resolved = await substituteCredentials(text, storage);
 * ```
 */
export class CLIPasswordStorage implements PasswordStorage {
  private derivedKey: CryptoKey;

  /**
   * @param derivedKey - The AES-GCM key derived from the master password.
   *   Must be obtained via deriveKey() or verifyMasterPassword() before use.
   */
  constructor(derivedKey: CryptoKey) {
    this.derivedKey = derivedKey;
  }

  /**
   * Get all stored credential references from the vault.
   *
   * Returns only { id, alias } without decrypted values,
   * matching the StoredPasswordRef interface.
   */
  async getPasswords(): Promise<StoredPasswordRef[]> {
    const vault = await readVault();
    return vault.credentials.map((c) => ({
      id: c.id,
      ...(c.alias !== undefined ? { alias: c.alias } : {}),
    }));
  }

  /**
   * Decrypt a credential's value from the vault.
   *
   * @param password - StoredPasswordRef with id to look up
   * @returns The decrypted plaintext credential value
   * @throws Error if the credential is not found in the vault
   * @throws Error if decryption fails (wrong key, corrupted data)
   */
  async decryptPassword(password: StoredPasswordRef): Promise<string> {
    const credential = await getCredential(password.id);

    if (!credential) {
      throw new Error(
        `Credential not found in vault: "${password.id}". ` +
        'The vault may have been modified since credentials were loaded.'
      );
    }

    return decrypt(credential.encryptedValue, this.derivedKey);
  }
}
