/**
 * Session storage module for saving and loading encrypted Playwright storageState snapshots.
 *
 * Stores encrypted session data (cookies + localStorage) in platform-specific
 * data directories, enabling CLI users to persist browser sessions across runs.
 *
 * Security model:
 * - Session files encrypted with device key (AES-GCM via vault/encryption.ts)
 * - Session directory: mode 0700 (owner-only access)
 * - Session files: mode 0600 (owner read/write only)
 * - Delete-before-write pattern for permission enforcement
 * - Expired sessions automatically deleted on load
 *
 * @see packages/cli/src/vault/encryption.ts for crypto operations
 * @see packages/cli/src/vault/storage.ts for device key management
 * @see packages/cli/src/vault/cache.ts for file permission patterns
 */

import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import envPaths from 'env-paths';
import { encrypt, decrypt } from '../vault/encryption.js';
import { getOrCreateDeviceKey } from '../vault/storage.js';

// --- Data Structures ---

/**
 * Playwright storageState format (as returned by context.storageState()).
 *
 * Contains cookies and localStorage entries for session restoration.
 */
export interface PlaywrightStorageState {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{
      name: string;
      value: string;
    }>;
  }>;
}

/**
 * Session snapshot file structure (encrypted on disk).
 *
 * The encryptedState field contains the AES-GCM encrypted PlaywrightStorageState JSON.
 */
export interface SessionSnapshot {
  /** Unique identifier: "session-{timestamp}-{randomHex}" */
  id: string;
  /** Origin URL for protocol validation */
  url: string;
  /** AES-GCM encrypted PlaywrightStorageState JSON */
  encryptedState: {
    /** Base64-encoded ciphertext */
    ciphertext: string;
    /** Base64-encoded IV for AES-GCM */
    iv: string;
  };
  /** Unix timestamp (ms) when session was captured */
  createdAt: number;
  /** Optional expiry timestamp (ms) */
  expiresAt?: number;
}

// --- Path Resolution ---

/**
 * Get the path to the sessions storage directory.
 *
 * Uses env-paths for cross-platform data directory:
 * - Linux: ~/.local/share/browserlet/sessions
 * - macOS: ~/Library/Application Support/browserlet/sessions
 * - Windows: %APPDATA%/browserlet/Data/sessions
 *
 * @returns Absolute path to sessions directory
 */
export function getSessionsPath(): string {
  const paths = envPaths('browserlet', { suffix: '' });
  return join(paths.data, 'sessions');
}

// --- Core Functions ---

/**
 * Save a session snapshot to disk with encryption.
 *
 * Encrypts the Playwright storageState using the device key,
 * then writes it to disk with secure file permissions.
 *
 * @param sessionId - Unique session identifier
 * @param url - Origin URL for protocol validation
 * @param state - Playwright storageState to encrypt and save
 * @returns Absolute path to saved session file
 */
export async function saveSessionSnapshot(
  sessionId: string,
  url: string,
  state: PlaywrightStorageState
): Promise<string> {
  // Get device key for encryption
  const deviceKey = await getOrCreateDeviceKey();

  // Serialize state to JSON and encrypt
  const stateJson = JSON.stringify(state);
  const encryptedState = await encrypt(stateJson, deviceKey);

  // Build snapshot structure
  const snapshot: SessionSnapshot = {
    id: sessionId,
    url,
    encryptedState,
    createdAt: Date.now(),
  };

  // Ensure sessions directory exists with owner-only access
  const sessionsDir = getSessionsPath();
  await mkdir(sessionsDir, { recursive: true, mode: 0o700 });

  // Build file path
  const filePath = join(sessionsDir, `${sessionId}.json`);

  // Delete-before-write pattern to enforce 0600 permissions
  // (mode option only applies to newly created files, not existing ones)
  await unlink(filePath).catch(() => {}); // Ignore ENOENT

  // Write snapshot with secure permissions
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });

  return filePath;
}

/**
 * Load and decrypt a session snapshot from disk.
 *
 * Reads the session file, checks expiry, decrypts the storageState,
 * and returns it. Returns null if file is missing, expired, or corrupted.
 *
 * @param sessionId - Unique session identifier
 * @returns Decrypted PlaywrightStorageState or null
 */
export async function loadSessionSnapshot(
  sessionId: string
): Promise<PlaywrightStorageState | null> {
  const filePath = join(getSessionsPath(), `${sessionId}.json`);

  try {
    // Read and parse session file
    const content = await readFile(filePath, 'utf-8');
    const snapshot: SessionSnapshot = JSON.parse(content);

    // Check expiry if set
    if (snapshot.expiresAt && Date.now() > snapshot.expiresAt) {
      // Expired - delete file and return null
      await unlink(filePath).catch(() => {});
      return null;
    }

    // Get device key for decryption
    const deviceKey = await getOrCreateDeviceKey();

    // Decrypt and parse state
    const stateJson = await decrypt(snapshot.encryptedState, deviceKey);
    return JSON.parse(stateJson) as PlaywrightStorageState;
  } catch (error: unknown) {
    // File missing - expected case, return null silently
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    // Corrupted or decryption failed - self-healing: delete and return null
    await unlink(filePath).catch(() => {});
    return null;
  }
}

/**
 * Load and decrypt a session snapshot with metadata (including URL).
 *
 * Same as loadSessionSnapshot but returns the session URL alongside
 * the decrypted state for protocol validation during restore.
 *
 * @param sessionId - Unique session identifier
 * @returns Object with decrypted state and session URL, or null
 */
export async function loadSessionWithMeta(
  sessionId: string
): Promise<{ state: PlaywrightStorageState; url: string } | null> {
  const filePath = join(getSessionsPath(), `${sessionId}.json`);

  try {
    const content = await readFile(filePath, 'utf-8');
    const snapshot: SessionSnapshot = JSON.parse(content);

    if (snapshot.expiresAt && Date.now() > snapshot.expiresAt) {
      await unlink(filePath).catch(() => {});
      return null;
    }

    const deviceKey = await getOrCreateDeviceKey();
    const stateJson = await decrypt(snapshot.encryptedState, deviceKey);
    const state = JSON.parse(stateJson) as PlaywrightStorageState;

    return { state, url: snapshot.url };
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    await unlink(filePath).catch(() => {});
    return null;
  }
}

/**
 * List all session snapshots with metadata (without decrypting).
 *
 * Reads session files and returns metadata sorted by createdAt descending.
 * Skips corrupted files gracefully.
 *
 * @returns Array of session metadata sorted by creation time (newest first)
 */
export async function listSessions(): Promise<
  Array<{ id: string; url: string; createdAt: number; expiresAt?: number }>
> {
  const sessionsDir = getSessionsPath();

  try {
    const files = await readdir(sessionsDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const sessions: Array<{
      id: string;
      url: string;
      createdAt: number;
      expiresAt?: number;
    }> = [];

    for (const file of jsonFiles) {
      try {
        const content = await readFile(join(sessionsDir, file), 'utf-8');
        const snapshot: SessionSnapshot = JSON.parse(content);
        sessions.push({
          id: snapshot.id,
          url: snapshot.url,
          createdAt: snapshot.createdAt,
          ...(snapshot.expiresAt !== undefined
            ? { expiresAt: snapshot.expiresAt }
            : {}),
        });
      } catch {
        // Skip corrupted files - self-healing
        continue;
      }
    }

    // Sort by createdAt descending (newest first)
    sessions.sort((a, b) => b.createdAt - a.createdAt);

    return sessions;
  } catch (error: unknown) {
    // Directory doesn't exist - no sessions yet
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Delete a session file from disk.
 *
 * @param sessionId - Unique session identifier
 * @returns true if deleted, false if file didn't exist
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const filePath = join(getSessionsPath(), `${sessionId}.json`);

  try {
    await unlink(filePath);
    return true;
  } catch (error: unknown) {
    // ENOENT is expected (file already deleted or never existed)
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

// --- Helper Functions ---

/**
 * Generate a unique session ID.
 *
 * Format: "session-{timestamp}-{randomHex}" where timestamp is Date.now()
 * and randomHex is 4 random bytes encoded as hex (8 characters).
 *
 * Example: "session-1708112345678-a3f2c1d4"
 *
 * @returns Unique session ID string
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  const random = randomBytes(4).toString('hex');
  return `session-${timestamp}-${random}`;
}

/**
 * Clean up expired sessions from disk.
 *
 * Lists all sessions and deletes any with an expiresAt timestamp in the past.
 * Runs sequentially (acceptable for small session counts).
 * Failures are silently ignored (graceful cleanup).
 *
 * Intended to be called during CLI startup for housekeeping.
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    const sessions = await listSessions();
    const now = Date.now();

    for (const session of sessions) {
      if (session.expiresAt && session.expiresAt < now) {
        await deleteSession(session.id).catch(() => {});
      }
    }
  } catch {
    // Graceful failure - expired sessions will be cleaned up on next run
  }
}

/**
 * Validate protocol compatibility between a saved session URL and a target URL.
 *
 * Protocol rules:
 * - Same protocol: valid, no warning
 * - HTTPS session -> HTTP target: invalid (security risk, cookies may leak)
 * - HTTP session -> HTTPS target: valid with warning (cookies may not persist)
 * - Invalid URLs: invalid with error message
 *
 * @param sessionUrl - URL the session was originally captured from
 * @param targetUrl - URL the session will be restored to
 * @returns Validation result with optional warning message
 */
export function validateProtocolMatch(
  sessionUrl: string,
  targetUrl: string
): { valid: boolean; warning?: string } {
  let sessionProtocol: string;
  let targetProtocol: string;

  try {
    sessionProtocol = new URL(sessionUrl).protocol;
  } catch {
    return { valid: false, warning: 'Invalid session URL format' };
  }

  try {
    targetProtocol = new URL(targetUrl).protocol;
  } catch {
    return { valid: false, warning: 'Invalid target URL format' };
  }

  // Same protocol - ideal case
  if (sessionProtocol === targetProtocol) {
    return { valid: true };
  }

  // HTTPS session -> HTTP target: security risk
  if (sessionProtocol === 'https:' && targetProtocol === 'http:') {
    return {
      valid: false,
      warning:
        'Cannot restore HTTPS session to HTTP URL (security risk)',
    };
  }

  // HTTP session -> HTTPS target: permissible but cookies may not persist
  if (sessionProtocol === 'http:' && targetProtocol === 'https:') {
    return {
      valid: true,
      warning:
        'Restoring HTTP session to HTTPS URL (cookies may not persist)',
    };
  }

  // Other protocol mismatch (e.g., ftp, file)
  return {
    valid: false,
    warning: `Protocol mismatch: session is ${sessionProtocol} but target is ${targetProtocol}`,
  };
}
