/**
 * In-page notification overlay for auto-execute triggers
 * Cross-platform alternative to Chrome notifications (which don't support buttons on macOS)
 */

let currentNotification: HTMLElement | null = null;

export interface NotificationOptions {
  scriptName: string;
  scriptId: string;
  onStop: () => void;
  onDisableSite: () => void;
}

/**
 * Show an in-page notification for auto-executing script
 * Displays at top of page with Stop and Disable buttons
 */
export function showAutoExecuteNotification(options: NotificationOptions): void {
  // Remove any existing notification
  hideNotification();

  const { scriptName, onStop, onDisableSite } = options;

  // Create container
  const container = document.createElement('div');
  container.id = 'browserlet-notification';
  container.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    background: #1a1a2e;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 320px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: browserlet-slide-in 0.3s ease-out;
  `;

  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes browserlet-slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes browserlet-slide-out {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  container.appendChild(style);

  // Header with icon and title
  const header = document.createElement('div');
  header.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  const icon = document.createElement('span');
  icon.textContent = '⚡';
  icon.style.fontSize = '16px';

  const title = document.createElement('span');
  title.style.cssText = 'font-weight: 600;';
  title.textContent = chrome.i18n.getMessage('notificationAutoExecuteTitle') || 'Script Auto-Executing';

  header.appendChild(icon);
  header.appendChild(title);

  // Script name
  const scriptLabel = document.createElement('div');
  scriptLabel.style.cssText = 'color: #a0a0a0; font-size: 13px;';
  scriptLabel.textContent = scriptName;

  // Buttons container
  const buttons = document.createElement('div');
  buttons.style.cssText = 'display: flex; gap: 8px; margin-top: 4px;';

  // Stop button
  const stopBtn = document.createElement('button');
  stopBtn.style.cssText = `
    flex: 1;
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    background: #e74c3c;
    color: white;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  `;
  stopBtn.textContent = chrome.i18n.getMessage('notificationStop') || 'Stop';
  stopBtn.onmouseover = () => { stopBtn.style.background = '#c0392b'; };
  stopBtn.onmouseout = () => { stopBtn.style.background = '#e74c3c'; };
  stopBtn.onclick = () => {
    onStop();
    hideNotification();
  };

  // Disable for site button
  const disableBtn = document.createElement('button');
  disableBtn.style.cssText = `
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #555;
    border-radius: 6px;
    background: transparent;
    color: #ccc;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  `;
  disableBtn.textContent = chrome.i18n.getMessage('notificationDisableSite') || 'Disable for site';
  disableBtn.onmouseover = () => {
    disableBtn.style.background = '#333';
    disableBtn.style.borderColor = '#777';
  };
  disableBtn.onmouseout = () => {
    disableBtn.style.background = 'transparent';
    disableBtn.style.borderColor = '#555';
  };
  disableBtn.onclick = () => {
    onDisableSite();
    hideNotification();
  };

  buttons.appendChild(stopBtn);
  buttons.appendChild(disableBtn);

  // Assemble notification
  container.appendChild(header);
  container.appendChild(scriptLabel);
  container.appendChild(buttons);

  // Add to page
  document.body.appendChild(container);
  currentNotification = container;

  // Auto-hide after 10 seconds
  setTimeout(() => {
    if (currentNotification === container) {
      hideNotification();
    }
  }, 10000);
}

/**
 * Show completion notification
 */
export function showCompletionNotification(scriptName: string, success: boolean): void {
  // Remove any existing notification
  hideNotification();

  const container = document.createElement('div');
  container.id = 'browserlet-notification';
  container.style.cssText = `
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2147483647;
    background: ${success ? '#27ae60' : '#e74c3c'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 320px;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: browserlet-slide-in 0.3s ease-out;
  `;

  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes browserlet-slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  container.appendChild(style);

  const icon = document.createElement('span');
  icon.textContent = success ? '✓' : '✗';
  icon.style.fontSize = '18px';

  const text = document.createElement('div');
  const title = document.createElement('div');
  title.style.fontWeight = '600';
  title.textContent = success
    ? (chrome.i18n.getMessage('notificationCompleteTitle') || 'Script Completed')
    : (chrome.i18n.getMessage('notificationFailedTitle') || 'Script Failed');

  const name = document.createElement('div');
  name.style.cssText = 'font-size: 13px; opacity: 0.9;';
  name.textContent = scriptName;

  text.appendChild(title);
  text.appendChild(name);

  container.appendChild(icon);
  container.appendChild(text);

  document.body.appendChild(container);
  currentNotification = container;

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (currentNotification === container) {
      hideNotification();
    }
  }, 5000);
}

/**
 * Hide current notification with slide-out animation
 */
export function hideNotification(): void {
  if (currentNotification) {
    const notification = currentNotification;
    notification.style.animation = 'browserlet-slide-out 0.2s ease-in forwards';
    setTimeout(() => {
      notification.remove();
    }, 200);
    currentNotification = null;
  }
}
