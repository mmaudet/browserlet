import type { EncryptedData } from '../crypto/encryption';

/**
 * Password entry stored in chrome.storage.local.
 * Password field is encrypted with AES-GCM.
 */
export interface StoredPassword {
  /** Unique ID (pwd-{timestamp}-{random}) */
  id: string;
  /** Optional user-friendly alias (e.g., "linagora_pwd") */
  alias?: string;
  /** Domain or URL pattern for matching */
  url: string;
  /** Stored plaintext (not sensitive) */
  username: string;
  /** AES-GCM encrypted password */
  encryptedPassword: EncryptedData;
  /** Unix timestamp */
  createdAt: number;
  /** Unix timestamp */
  updatedAt: number;
}

/**
 * Password detected during recording (before encryption).
 * Captured by PasswordCapture content script.
 */
export interface DetectedPassword {
  /** Full URL where password was entered */
  url: string;
  /** Associated username (if detected) */
  username: string;
  /** Plaintext password (will be encrypted before storage) */
  password: string;
  /** CSS selector hint for the password field */
  fieldSelector: string;
}
