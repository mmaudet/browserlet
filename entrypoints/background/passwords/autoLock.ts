import { lockVault, getVaultState } from '../../../utils/passwords/vault';

const LOCK_ALARM_NAME = 'browserlet_vault_auto_lock';
const LOCK_TIMEOUT_MINUTES = 15;

/**
 * Reset the auto-lock timer.
 * Called on vault access and user activity.
 */
export async function resetAutoLockTimer(): Promise<void> {
  // Clear existing alarm
  await chrome.alarms.clear(LOCK_ALARM_NAME);

  // Create new alarm (Chrome 120+ allows 0.5 minute minimum)
  await chrome.alarms.create(LOCK_ALARM_NAME, {
    delayInMinutes: LOCK_TIMEOUT_MINUTES
  });

  console.log('[Browserlet] Auto-lock timer reset, will lock in', LOCK_TIMEOUT_MINUTES, 'minutes');
}

/**
 * Clear the auto-lock timer (on manual lock or browser close).
 */
export async function clearAutoLockTimer(): Promise<void> {
  await chrome.alarms.clear(LOCK_ALARM_NAME);
}

/**
 * Setup alarm listener. Call once at service worker startup.
 */
export function setupAutoLockListener(): void {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === LOCK_ALARM_NAME) {
      console.log('[Browserlet] Auto-lock timer fired, locking vault');
      await lockVault();
      // Clear the alarm after it fires
      await clearAutoLockTimer();
    }
  });

  // Also listen for idle state changes to reset timer
  chrome.idle.onStateChanged.addListener(async (state) => {
    if (state === 'active') {
      // User became active - check if vault is unlocked and reset timer
      const vaultState = await getVaultState();
      if (!vaultState.isLocked) {
        await resetAutoLockTimer();
      }
    }
  });
}
