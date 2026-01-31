/**
 * Migration utilities for legacy session-encrypted credentials.
 *
 * Users with v1.1 credentials cannot decrypt them after browser restart
 * because the session key is lost. This module provides:
 * - Detection of migration-needed state
 * - Metadata extraction for display
 * - Atomic credential save during migration
 * - Migration completion tracking
 */

import { hasMasterPasswordSetup } from '../crypto/masterPassword';
import { getPasswords } from './storage';
import type { StoredPassword } from './types';

// Storage keys
const MIGRATION_COMPLETED_KEY = 'browserlet_migration_completed';
const PASSWORDS_STORAGE_KEY = 'browserlet_passwords';

/**
 * Migration state returned by detectMigrationState().
 */
export interface MigrationState {
  /** True if user should see migration flow */
  needsMigration: boolean;
  /** True if there are stored credentials (may be legacy) */
  hasLegacyCredentials: boolean;
  /** True if master password validation data exists */
  hasMasterPassword: boolean;
  /** True if migration was previously completed */
  migrationCompleted: boolean;
  /** Number of credentials to migrate */
  credentialCount: number;
}

/**
 * Legacy credential metadata for display during migration.
 * Does not include the encrypted password (which can't be decrypted).
 */
export interface LegacyCredentialMetadata {
  id: string;
  url: string;
  username: string;
  alias?: string;
}

/**
 * Detect whether the user needs to go through migration flow.
 *
 * Migration is needed when:
 * - User has stored credentials (legacy from v1.1)
 * - User does NOT have master password set up
 * - Migration has not been completed previously
 *
 * @returns MigrationState with all detection flags
 */
export async function detectMigrationState(): Promise<MigrationState> {
  const [passwords, hasMasterPassword, migrationResult] = await Promise.all([
    getPasswords(),
    hasMasterPasswordSetup(),
    chrome.storage.local.get(MIGRATION_COMPLETED_KEY),
  ]);

  const hasLegacyCredentials = passwords.length > 0;
  const migrationCompleted = migrationResult[MIGRATION_COMPLETED_KEY] !== undefined;

  // Migration needed if:
  // - Has credentials from v1.1 (legacy)
  // - No master password set up yet
  // - Migration not already completed
  const needsMigration =
    hasLegacyCredentials && !hasMasterPassword && !migrationCompleted;

  return {
    needsMigration,
    hasLegacyCredentials,
    hasMasterPassword,
    migrationCompleted,
    credentialCount: passwords.length,
  };
}

/**
 * Mark migration as complete to prevent re-prompting.
 *
 * Stores timestamp in chrome.storage.local. Once set, the migration
 * flow will not appear again even if there are legacy credentials.
 */
export async function markMigrationComplete(): Promise<void> {
  await chrome.storage.local.set({
    [MIGRATION_COMPLETED_KEY]: Date.now(),
  });
}

/**
 * Get metadata for all legacy credentials (safe to display).
 *
 * Returns id, url, username, and alias for each credential.
 * Does NOT include the encrypted password (which can't be decrypted
 * because the session key is lost).
 *
 * @returns Array of credential metadata for migration UI
 */
export async function getLegacyCredentialMetadata(): Promise<LegacyCredentialMetadata[]> {
  const passwords = await getPasswords();

  return passwords.map((p) => ({
    id: p.id,
    url: p.url,
    username: p.username,
    alias: p.alias,
  }));
}

/**
 * Atomically save all migrated credentials.
 *
 * Overwrites the entire browserlet_passwords array with newly encrypted
 * credentials. This ensures atomic update during migration.
 *
 * @param credentials - Array of StoredPassword with master password encryption
 */
export async function saveMigratedCredentials(
  credentials: StoredPassword[]
): Promise<void> {
  await chrome.storage.local.set({
    [PASSWORDS_STORAGE_KEY]: credentials,
  });
}
