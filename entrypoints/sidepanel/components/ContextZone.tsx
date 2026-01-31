import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

// Context state - exported signals for use by other components
export const currentUrl = signal('');
export const currentTitle = signal('');
export const isLoading = signal(true);

// Update context from active tab
export async function updateContext(): Promise<void> {
  try {
    // Check if tabs API is available
    if (!chrome.tabs?.query) {
      console.warn('chrome.tabs.query not available');
      isLoading.value = false;
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      currentUrl.value = tab.url || '';
      currentTitle.value = tab.title || '';
    }
  } catch (error) {
    console.error('Failed to get tab info:', error);
  } finally {
    isLoading.value = false;
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
  // Load initial context on mount
  useEffect(() => {
    updateContext();
  }, []);

  // Compute display URL
  const displayUrl = (() => {
    if (!currentUrl.value) return '';
    try {
      const url = new URL(currentUrl.value);
      return url.hostname + url.pathname;
    } catch {
      return currentUrl.value;
    }
  })();

  return (
    <div
      class="context-zone"
      style={{
        padding: '12px',
        background: '#f5f5f5',
        borderRadius: '8px',
        marginBottom: '16px'
      }}
    >
      <div style={{
        fontSize: '11px',
        color: '#666',
        textTransform: 'uppercase',
        marginBottom: '4px'
      }}>
        {chrome.i18n.getMessage('contextZoneTitle') || 'Context'}
      </div>

      {isLoading.value ? (
        <div style={{ fontSize: '13px', color: '#999' }}>
          {chrome.i18n.getMessage('loading') || 'Loading...'}
        </div>
      ) : currentUrl.value ? (
        <div>
          <div style={{
            fontWeight: 500,
            color: '#333',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {currentTitle.value || 'Untitled'}
          </div>
          <div style={{
            fontSize: '11px',
            color: '#888',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: '2px'
          }}>
            {displayUrl}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '13px', color: '#999' }}>
          {chrome.i18n.getMessage('noPage') || 'No page detected'}
        </div>
      )}
    </div>
  );
}
