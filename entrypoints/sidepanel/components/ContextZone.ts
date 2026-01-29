import van from 'vanjs-core';

const { div, span } = van.tags;

// Context state
export const currentUrl = van.state('');
export const currentTitle = van.state('');

// Update context from active tab
export async function updateContext(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      currentUrl.val = tab.url || '';
      currentTitle.val = tab.title || '';
    }
  } catch (error) {
    console.error('Failed to get tab info:', error);
  }
}

// Listen for tab changes
chrome.tabs.onActivated.addListener(() => {
  updateContext();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.title) {
    updateContext();
  }
});

export function ContextZone() {
  // Load initial context
  updateContext();

  return div({
    class: 'context-zone',
    style: 'padding: 12px; background: #f5f5f5; border-radius: 8px; margin-bottom: 16px;'
  },
    div({ style: 'font-size: 11px; color: #666; text-transform: uppercase; margin-bottom: 4px;' },
      chrome.i18n.getMessage('contextZoneTitle') || 'Context'
    ),
    () => currentUrl.val ? div(
      div({
        style: 'font-weight: 500; color: #333; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
      }, currentTitle.val || chrome.i18n.getMessage('loading') || 'Untitled'),
      div({
        style: 'font-size: 11px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;'
      }, () => {
        try {
          const url = new URL(currentUrl.val);
          return url.hostname + url.pathname;
        } catch {
          return currentUrl.val;
        }
      })
    ) : div({
      style: 'font-size: 13px; color: #999;'
    }, chrome.i18n.getMessage('loading') || 'No page detected')
  );
}
