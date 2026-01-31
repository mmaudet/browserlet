import { hasMasterPasswordSetup } from '../crypto/masterPassword';

const VAULT_STATE_KEY = 'browserlet_vault_state';

export interface VaultState {
  isLocked: boolean;
  lastUnlockTime: number; // Unix timestamp, 0 when locked
  needsSetup: boolean; // true if master password not yet configured
}

/**
 * Get current vault state.
 * Defaults to locked if no session state (browser restarted).
 * Detects if master password setup is needed.
 */
export async function getVaultState(): Promise<VaultState> {
  const [sessionState, hasSetup] = await Promise.all([
    chrome.storage.session.get(VAULT_STATE_KEY),
    hasMasterPasswordSetup()
  ]);

  const state = sessionState[VAULT_STATE_KEY] as Partial<VaultState> | undefined;

  return {
    isLocked: state?.isLocked ?? true,
    lastUnlockTime: state?.lastUnlockTime ?? 0,
    needsSetup: !hasSetup
  };
}

/**
 * Unlock the vault.
 * Sets isLocked to false and records unlock time.
 */
export async function unlockVault(): Promise<void> {
  await chrome.storage.session.set({
    [VAULT_STATE_KEY]: { isLocked: false, lastUnlockTime: Date.now() }
  });
}

/**
 * Lock the vault.
 * Sets isLocked to true and clears unlock time.
 */
export async function lockVault(): Promise<void> {
  await chrome.storage.session.set({
    [VAULT_STATE_KEY]: { isLocked: true, lastUnlockTime: 0 }
  });
}
