import van from 'vanjs-core';

const { div, span } = van.tags;

// Context state
export const currentUrl = van.state('');
export const currentTitle = van.state('');
export const isLoading = van.state(true);

// Update context from active tab
export async function updateContext(): Promise<void> {
  try {
    // Check if tabs API is available
    if (!chrome.tabs?.query) {
      console.warn('chrome.tabs.query not available');
      isLoading.val = false;
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      currentUrl.val = tab.url || '';
      currentTitle.val = tab.title || '';
    }
  } catch (error) {
    console.error('Failed to get tab info:', error);
  } finally {
    isLoading.val = false;
  }
}

// Set up tab change listeners only if API available
if (chrome.tabs?.onActivated) {
  chrome.tabs.onActivated.addListener(() => {
    updateContext();
  });
}

if (chrome.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.title) {
      updateContext();
    }
  });
}

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
    () => {
      if (isLoading.val) {
        return div({
          style: 'font-size: 13px; color: #999;'
        }, chrome.i18n.getMessage('loading') || 'Loading...');
      }

      if (currentUrl.val) {
        return div(
          div({
            style: 'font-weight: 500; color: #333; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'
          }, currentTitle.val || 'Untitled'),
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
        );
      }

      return div({
        style: 'font-size: 13px; color: #999;'
      }, chrome.i18n.getMessage('noPage') || 'No page detected');
    }
  );
}
