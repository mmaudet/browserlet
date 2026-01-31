import { signal } from '@preact/signals';
import type { StoredPassword } from '../../../utils/passwords/types';
import { getPasswords } from '../../../utils/passwords/storage';
import { getVaultState, type VaultState } from '../../../utils/passwords/vault';

// Reactive store for password vault
export const passwordStore = {
  passwords: signal<StoredPassword[]>([]),
  vaultState: signal<VaultState>({ isLocked: true, lastUnlockTime: 0, needsSetup: true }),
  isLoading: signal(false),
  error: signal<string | null>(null),
};

/**
 * Load passwords and vault state from storage.
 * Called on sidepanel mount and after password operations.
 */
export async function loadPasswords(): Promise<void> {
  passwordStore.isLoading.value = true;
  passwordStore.error.value = null;

  try {
    const [passwords, vaultState] = await Promise.all([
      getPasswords(),
      getVaultState(),
    ]);
    passwordStore.passwords.value = passwords;
    passwordStore.vaultState.value = vaultState;
  } catch (error) {
    console.error('Failed to load passwords:', error);
    passwordStore.error.value = error instanceof Error ? error.message : 'Failed to load passwords';
  } finally {
    passwordStore.isLoading.value = false;
  }
}

/**
 * Refresh vault state only (for lock state changes).
 */
export async function refreshVaultState(): Promise<void> {
  try {
    const vaultState = await getVaultState();
    passwordStore.vaultState.value = vaultState;
  } catch (error) {
    console.error('Failed to refresh vault state:', error);
  }
}
