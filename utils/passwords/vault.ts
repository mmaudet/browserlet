const VAULT_STATE_KEY = 'browserlet_vault_state';

export interface VaultState {
  isLocked: boolean;
  lastUnlockTime: number; // Unix timestamp, 0 when locked
}

/**
 * Get current vault state.
 * Defaults to locked if no session state (browser restarted).
 */
export async function getVaultState(): Promise<VaultState> {
  const result = await chrome.storage.session.get(VAULT_STATE_KEY);
  const state = result[VAULT_STATE_KEY] as VaultState | undefined;
  return state ?? { isLocked: true, lastUnlockTime: 0 };
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
