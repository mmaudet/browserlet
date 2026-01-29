import type { Message, MessageResponse, AppState, PingResponse } from '../../utils/types';

// DOM elements
const swStatus = document.getElementById('sw-status')!;
const stateDisplay = document.getElementById('state-display')!;
const refreshBtn = document.getElementById('refresh-state')!;
const pingBtn = document.getElementById('ping-sw')!;

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init(): Promise<void> {
  console.log('[Browserlet Side Panel] Initializing...');

  // Check service worker connection
  await pingServiceWorker();

  // Load initial state
  await loadState();

  // Listen for storage changes - automatic updates without explicit messaging
  chrome.storage.onChanged.addListener(handleStorageChange);

  // Set up button handlers
  refreshBtn.addEventListener('click', loadState);
  pingBtn.addEventListener('click', pingServiceWorker);

  console.log('[Browserlet Side Panel] Ready');
}

async function pingServiceWorker(): Promise<void> {
  try {
    const response = await sendMessage<PingResponse>({ type: 'PING' });

    if (response.success && response.data) {
      swStatus.textContent = `Connected (${new Date(response.data.timestamp).toLocaleTimeString()})`;
      swStatus.className = 'status-value status-ok';
    } else {
      swStatus.textContent = `Error: ${response.error || 'Unknown error'}`;
      swStatus.className = 'status-value status-error';
    }
  } catch (error) {
    swStatus.textContent = `Disconnected: ${error instanceof Error ? error.message : 'Unknown error'}`;
    swStatus.className = 'status-value status-error';
  }
}

async function loadState(): Promise<void> {
  try {
    const response = await sendMessage<AppState>({ type: 'GET_STATE' });

    if (response.success && response.data) {
      stateDisplay.textContent = JSON.stringify(response.data, null, 2);
    } else {
      stateDisplay.textContent = `Error: ${response.error || 'Unknown error'}`;
    }
  } catch (error) {
    stateDisplay.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

function handleStorageChange(
  changes: { [key: string]: chrome.storage.StorageChange },
  namespace: string
): void {
  if (namespace !== 'local') return;

  console.log('[Browserlet Side Panel] Storage changed:', changes);

  // Refresh state display when appState changes
  if (changes.appState) {
    stateDisplay.textContent = JSON.stringify(changes.appState.newValue, null, 2);
  }
}

async function sendMessage<T>(message: Message): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage(message);
}
