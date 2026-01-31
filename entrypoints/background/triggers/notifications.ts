/**
 * Chrome notification handling for auto-execute triggers
 * Creates system notifications with Stop/Disable buttons
 */

import { setSiteOverride } from '../../../utils/storage/triggers';

// Store active notifications to track script associations
const activeNotifications = new Map<string, { scriptId: string; tabId: number; url: string }>();

/**
 * Create notification for auto-executing script
 * @param scriptName - Script name to display
 * @param scriptId - Script ID for tracking
 * @param tabId - Tab where script is running
 * @param url - Tab URL for site override
 * @returns notification ID
 */
export async function notifyAutoExecution(
  scriptName: string,
  scriptId: string,
  tabId: number,
  url: string
): Promise<string> {
  const notificationId = `script_${scriptId}_${Date.now()}`;

  try {
    await chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon/128.png'),
      title: chrome.i18n.getMessage('notificationAutoExecuteTitle') || 'Script Auto-Executing',
      message: chrome.i18n.getMessage('notificationAutoExecuteMessage', [scriptName]) ||
               `Running: ${scriptName}`,
      buttons: [
        { title: chrome.i18n.getMessage('notificationStop') || 'Stop' },
        { title: chrome.i18n.getMessage('notificationDisableSite') || 'Disable for this site' }
      ],
      requireInteraction: false,
      priority: 0
    });

    // Track notification for button handling
    activeNotifications.set(notificationId, { scriptId, tabId, url });

    // Auto-clear notification after 10 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
      activeNotifications.delete(notificationId);
    }, 10000);
  } catch (error) {
    console.warn('[Browserlet] Failed to create notification:', error);
    // Continue with execution even if notification fails
  }

  return notificationId;
}

/**
 * Create notification for script completion
 */
export async function notifyExecutionComplete(
  scriptName: string,
  success: boolean
): Promise<void> {
  const notificationId = `complete_${Date.now()}`;

  try {
    await chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon/128.png'),
      title: success
        ? (chrome.i18n.getMessage('notificationCompleteTitle') || 'Script Completed')
        : (chrome.i18n.getMessage('notificationFailedTitle') || 'Script Failed'),
      message: scriptName,
      requireInteraction: false,
      priority: 0
    });

    // Auto-clear after 5 seconds
    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, 5000);
  } catch (error) {
    console.warn('[Browserlet] Failed to create completion notification:', error);
  }
}

/**
 * Set up notification button click handlers
 * Must be called once during service worker initialization
 */
export function setupNotificationListeners(): void {
  chrome.notifications.onButtonClicked.addListener(
    async (notificationId: string, buttonIndex: number) => {
      const info = activeNotifications.get(notificationId);
      if (!info) return;

      if (buttonIndex === 0) {
        // Stop execution
        try {
          await chrome.tabs.sendMessage(info.tabId, { type: 'STOP_EXECUTION' });
        } catch {
          // Tab might be closed
        }
      } else if (buttonIndex === 1) {
        // Disable for this site
        await setSiteOverride(info.scriptId, info.url, false);
      }

      // Clear notification
      chrome.notifications.clear(notificationId);
      activeNotifications.delete(notificationId);
    }
  );

  // Clean up when notification is closed by user
  chrome.notifications.onClosed.addListener((notificationId: string) => {
    activeNotifications.delete(notificationId);
  });
}

/**
 * Clear all trigger-related notifications
 */
export function clearAllNotifications(): void {
  activeNotifications.forEach((_, notificationId) => {
    chrome.notifications.clear(notificationId);
  });
  activeNotifications.clear();
}
