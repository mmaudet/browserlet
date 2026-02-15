/**
 * Import credentials from Chrome extension's chrome.storage.local.
 *
 * Reads the extension's LevelDB storage directly from the Chrome profile
 * directory. Supports macOS, Linux, and Windows paths.
 *
 * Chrome stores extension data in:
 *   <profile>/Local Extension Settings/<extension-id>/
 *
 * Extension storage keys:
 *   browserlet_pbkdf2_salt       — Base64 salt string
 *   browserlet_validation_data   — { ciphertext, iv }
 *   browserlet_passwords         — StoredPassword[]
 *
 * The encryption is byte-compatible with the CLI vault (PBKDF2 600k + AES-GCM 256).
 */

import { homedir, platform, tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { existsSync, readdirSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { ClassicLevel } from 'classic-level';

/** Credential as stored by the Chrome extension */
export interface ExtensionCredential {
  id: string;
  alias?: string;
  url: string;
  username: string;
  encryptedPassword: { ciphertext: string; iv: string };
  createdAt: number;
  updatedAt: number;
}

/** Complete extension vault data */
export interface ExtensionVaultData {
  salt: string;
  validationData: { ciphertext: string; iv: string };
  credentials: ExtensionCredential[];
}

/**
 * Get possible Chrome profile directories for the current platform.
 * Returns paths that may contain extension data.
 */
function getChromeProfileDirs(): string[] {
  const home = homedir();
  const os = platform();
  const dirs: string[] = [];

  let chromeBase: string;
  if (os === 'darwin') {
    chromeBase = join(home, 'Library', 'Application Support', 'Google', 'Chrome');
  } else if (os === 'win32') {
    chromeBase = join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
  } else {
    // Linux
    chromeBase = join(home, '.config', 'google-chrome');
  }

  if (!existsSync(chromeBase)) return dirs;

  // Check Default profile and numbered profiles (Profile 1, Profile 2, etc.)
  for (const entry of readdirSync(chromeBase)) {
    if (entry === 'Default' || entry.startsWith('Profile ')) {
      const profileDir = join(chromeBase, entry);
      const extDir = join(profileDir, 'Local Extension Settings');
      if (existsSync(extDir)) {
        dirs.push(extDir);
      }
    }
  }

  return dirs;
}

/**
 * Find the Browserlet extension ID by scanning all extension storage dirs
 * for one that contains the browserlet_pbkdf2_salt key.
 *
 * Copies LevelDB to a temp dir to avoid Chrome's lock.
 *
 * @returns { extDir, tempDir } or null if not found
 */
async function findBrowserletExtension(): Promise<{ extDir: string; tempDir: string; extensionId: string } | null> {
  const profileDirs = getChromeProfileDirs();

  for (const extSettingsDir of profileDirs) {
    const extensionIds = readdirSync(extSettingsDir);

    for (const extId of extensionIds) {
      const extDir = join(extSettingsDir, extId);

      // Copy LevelDB to temp to avoid Chrome lock conflicts
      const tempDir = mkdtempSync(join(tmpdir(), 'browserlet-import-'));
      const tempDbDir = join(tempDir, 'db');

      try {
        cpSync(extDir, tempDbDir, { recursive: true });

        // Remove LOCK file so we can open the copy
        const lockFile = join(tempDbDir, 'LOCK');
        if (existsSync(lockFile)) {
          rmSync(lockFile);
        }

        const db = new ClassicLevel(tempDbDir, { valueEncoding: 'utf8' });
        try {
          await db.open();
          const salt = await db.get('browserlet_pbkdf2_salt').catch(() => null);
          await db.close();

          if (salt !== null) {
            return { extDir, tempDir: tempDbDir, extensionId: extId };
          }
        } catch {
          try { await db.close(); } catch { /* ignore */ }
        }
      } catch {
        // Not a valid LevelDB dir or copy failed
      }

      // Clean up temp if this wasn't the right extension
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  return null;
}

/**
 * Read the extension's vault data from its LevelDB storage.
 *
 * @param dbDir - Path to the (copied) LevelDB directory
 * @returns ExtensionVaultData or null if vault not configured
 */
async function readExtensionVault(dbDir: string): Promise<ExtensionVaultData | null> {
  const db = new ClassicLevel(dbDir, { valueEncoding: 'utf8' });

  try {
    await db.open();

    const saltRaw = await db.get('browserlet_pbkdf2_salt').catch(() => null);
    const validationRaw = await db.get('browserlet_validation_data').catch(() => null);
    const passwordsRaw = await db.get('browserlet_passwords').catch(() => null);

    await db.close();

    if (!saltRaw || !validationRaw) {
      return null;
    }

    // Chrome stores values as JSON strings
    const salt = JSON.parse(saltRaw);
    const validationData = JSON.parse(validationRaw);
    const credentials: ExtensionCredential[] = passwordsRaw ? JSON.parse(passwordsRaw) : [];

    return { salt, validationData, credentials };
  } catch {
    try { await db.close(); } catch { /* ignore */ }
    return null;
  }
}

/**
 * Import vault data from the Chrome extension.
 *
 * Scans Chrome profiles, finds the Browserlet extension,
 * reads its vault data, and returns it.
 *
 * @returns ExtensionVaultData and cleanup function, or null
 */
export async function importFromExtension(): Promise<{ data: ExtensionVaultData; extensionId: string; cleanup: () => void } | null> {
  const found = await findBrowserletExtension();
  if (!found) {
    return null;
  }

  const data = await readExtensionVault(found.tempDir);
  if (!data) {
    rmSync(found.tempDir, { recursive: true, force: true });
    return null;
  }

  return {
    data,
    extensionId: found.extensionId,
    cleanup: () => {
      // Find the parent temp dir (tempDir is the 'db' subdir)
      const parentTemp = join(found.tempDir, '..');
      rmSync(parentTemp, { recursive: true, force: true });
    },
  };
}
