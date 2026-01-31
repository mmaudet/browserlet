import { getPasswords, savePassword, deletePassword } from '../../../utils/passwords/storage';
import { getVaultState, unlockVault, lockVault } from '../../../utils/passwords/vault';
import { substituteCredentials } from '../../../utils/passwords/substitution';
import { resetAutoLockTimer, clearAutoLockTimer, setupAutoLockListener } from './autoLock';
import type { DetectedPassword } from '../../../utils/passwords/types';

export { setupAutoLockListener };

/**
 * Initialize password infrastructure.
 * Call once at service worker startup.
 */
export function initializePasswordInfrastructure(): void {
  setupAutoLockListener();
  console.log('[Browserlet] Password infrastructure initialized');
}

/**
 * Handle password-related messages from sidepanel/content scripts.
 */
export async function handlePasswordMessage(
  type: string,
  payload: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    switch (type) {
      case 'GET_VAULT_STATE': {
        const state = await getVaultState();
        return { success: true, data: state };
      }

      case 'UNLOCK_VAULT': {
        await unlockVault();
        await resetAutoLockTimer();
        return { success: true };
      }

      case 'LOCK_VAULT': {
        await lockVault();
        await clearAutoLockTimer();
        return { success: true };
      }

      case 'GET_PASSWORDS': {
        const passwords = await getPasswords();
        return { success: true, data: passwords };
      }

      case 'SAVE_PASSWORD': {
        const detected = payload as DetectedPassword;
        await savePassword(detected.url, detected.username, detected.password);
        return { success: true };
      }

      case 'SAVE_PASSWORDS': {
        const detected = payload as DetectedPassword[];
        for (const pwd of detected) {
          await savePassword(pwd.url, pwd.username, pwd.password);
        }
        return { success: true };
      }

      case 'DELETE_PASSWORD': {
        const id = payload as string;
        await deletePassword(id);
        return { success: true };
      }

      case 'SUBSTITUTE_CREDENTIALS': {
        const text = payload as string;
        const passwords = await getPasswords();
        const substituted = await substituteCredentials(text, passwords);
        return { success: true, data: substituted };
      }

      default:
        return { success: false, error: `Unknown password message type: ${type}` };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Password operation failed'
    };
  }
}
