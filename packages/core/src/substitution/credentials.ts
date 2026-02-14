/**
 * Credential substitution with adapter pattern
 *
 * Uses a PasswordStorage adapter interface so the extension and CLI
 * can provide their own credential backends without browser dependencies.
 *
 * Pattern: {{credential:name}}
 */

/**
 * Regex pattern for credential references: {{credential:name}}
 * Name must contain only alphanumeric characters, dashes, and underscores.
 */
export const CREDENTIAL_PATTERN = /\{\{credential:([a-zA-Z0-9_-]+)\}\}/g;

/**
 * A credential reference found in text.
 */
export interface CredentialReference {
  /** Original matched text (e.g., "{{credential:github_pwd}}") */
  original: string;
  /** Credential name (e.g., "github_pwd") */
  name: string;
}

/**
 * Minimal password reference for the adapter interface.
 * Extension and CLI implement their own storage with these fields.
 */
export interface StoredPasswordRef {
  id: string;
  alias?: string;
}

/**
 * Adapter interface for credential storage backends.
 *
 * The extension implements this wrapping browser storage + AES-GCM decryption.
 * The CLI will implement this wrapping a local keychain or env vars.
 */
export interface PasswordStorage {
  getPasswords(): Promise<StoredPasswordRef[]>;
  decryptPassword(password: StoredPasswordRef): Promise<string>;
}

/**
 * Extract all credential references from text.
 *
 * @param text - Text to search for credential references
 * @returns Array of credential references found
 *
 * @example
 * extractCredentialRefs("pass={{credential:pwd}}")
 * // => [{ original: "{{credential:pwd}}", name: "pwd" }]
 */
export function extractCredentialRefs(text: string): CredentialReference[] {
  const refs: CredentialReference[] = [];
  // Reset lastIndex to ensure regex starts from beginning
  CREDENTIAL_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CREDENTIAL_PATTERN.exec(text)) !== null) {
    if (match[1]) {
      refs.push({
        original: match[0],
        name: match[1],
      });
    }
  }

  return refs;
}

/**
 * Substitute credential references with decrypted passwords using the adapter.
 *
 * @param text - Text containing credential references
 * @param storage - PasswordStorage adapter for credential resolution
 * @returns Text with references replaced by actual passwords
 * @throws Error if a referenced credential is not found
 *
 * @example
 * const storage: PasswordStorage = { ... };
 * await substituteCredentials("pass={{credential:pwd}}", storage)
 * // => "pass=actualPasswordValue"
 */
export async function substituteCredentials(
  text: string,
  storage: PasswordStorage
): Promise<string> {
  const refs = extractCredentialRefs(text);

  // No references, return unchanged
  if (refs.length === 0) {
    return text;
  }

  const passwords = await storage.getPasswords();
  let result = text;

  // Process each reference
  for (const ref of refs) {
    // Find password by ID or alias (exact match)
    const password = passwords.find(p => p.id === ref.name || p.alias === ref.name);

    if (!password) {
      throw new Error(
        `Credential not found: "${ref.name}". ` +
        `Available credentials: ${passwords.map(p => p.alias || p.id).join(', ') || 'none'}`
      );
    }

    // Decrypt and substitute
    const decrypted = await storage.decryptPassword(password);
    result = result.replace(ref.original, decrypted);
  }

  return result;
}
