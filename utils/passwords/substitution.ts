/**
 * Password credential substitution
 * Re-export shim: pure functions forwarded from @browserlet/core/substitution.
 * Backward-compatible substituteCredentials wrapper using browser PasswordStorage adapter.
 */

// Re-export pure functions from shared package
export { extractCredentialRefs, CREDENTIAL_PATTERN } from '@browserlet/core/substitution';
export type { CredentialReference } from '@browserlet/core/substitution';

// Adapter-based credential substitution
import { substituteCredentials as coreSubstitute } from '@browserlet/core/substitution';
import type { PasswordStorage } from '@browserlet/core/substitution';
import { getDecryptedPassword } from './storage';
import type { StoredPassword } from './types';

/**
 * Substitute credential references with decrypted passwords.
 * Backward-compatible wrapper preserving the existing call signature
 * used by entrypoints/background/passwords/index.ts.
 *
 * @param text - Text containing credential references
 * @param passwords - Array of stored passwords to search
 * @returns Text with references replaced by actual passwords
 * @throws Error if a referenced credential is not found
 */
export async function substituteCredentials(
  text: string,
  passwords: StoredPassword[]
): Promise<string> {
  const adapter: PasswordStorage = {
    getPasswords: async () => passwords.map(p => ({ id: p.id, alias: p.alias })),
    decryptPassword: async (ref) => {
      const pw = passwords.find(p => p.id === ref.id);
      if (!pw) throw new Error(`Password not found: ${ref.id}`);
      return getDecryptedPassword(pw);
    },
  };
  return coreSubstitute(text, adapter);
}
