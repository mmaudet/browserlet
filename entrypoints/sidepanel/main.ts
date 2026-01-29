// Elements
const swStatusEl = document.getElementById('sw-status')!;
const recordingStatusEl = document.getElementById('recording-status')!;
const recordBtnEl = document.getElementById('record-btn')! as HTMLButtonElement;
const actionsCountEl = document.getElementById('actions-count')!;
const actionsListEl = document.getElementById('actions-list')!;

// State
let isRecording = false;

// Initialize
init();

async function init() {
  // Check service worker connection
  try {
    const response = await chrome.runtime.sendMessage({ type: 'PING' });
    if (response.success) {
      swStatusEl.textContent = 'Connected';
      swStatusEl.classList.add('connected');
    } else {
      swStatusEl.textContent = 'Error';
    }
  } catch (error) {
    swStatusEl.textContent = 'Disconnected';
  }

  // Load initial state
  await loadState();

  // Set up event listeners
  recordBtnEl.addEventListener('click', toggleRecording);

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.appState) {
      updateUI(changes.appState.newValue as AppState);
    }
  });
}

async function loadState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (response.success && response.data) {
      updateUI(response.data);
    }
  } catch (error) {
    console.error('Failed to load state:', error);
  }
}

interface AppState {
  recordingState?: 'idle' | 'recording' | 'paused';
  recordedActions?: Array<{
    type: string;
    timestamp: number;
    url: string;
    hints: Array<{ type: string; value: unknown }>;
    value?: string;
  }>;
}

function updateUI(state: AppState) {
  // Update recording status
  isRecording = state.recordingState === 'recording';

  if (isRecording) {
    recordingStatusEl.textContent = 'Recording';
    recordingStatusEl.classList.add('recording');
    recordBtnEl.textContent = 'Stop Recording';
    recordBtnEl.classList.remove('btn-primary');
    recordBtnEl.classList.add('btn-danger');
  } else {
    recordingStatusEl.textContent = 'Idle';
    recordingStatusEl.classList.remove('recording');
    recordBtnEl.textContent = 'Start Recording';
    recordBtnEl.classList.remove('btn-danger');
    recordBtnEl.classList.add('btn-primary');
  }

  // Update actions list
  const actions = state.recordedActions || [];
  actionsCountEl.textContent = actions.length.toString();

  if (actions.length === 0) {
    actionsListEl.innerHTML = '<div class="empty-state">No actions recorded yet</div>';
  } else {
    actionsListEl.innerHTML = actions
      .slice(-20) // Show last 20 actions
      .reverse() // Most recent first
      .map(action => {
        const hint = action.hints[0];
        const hintText = hint ? `${hint.type}: ${typeof hint.value === 'string' ? hint.value : JSON.stringify(hint.value)}` : '';
        const valueText = action.value ? ` = "${action.value.substring(0, 30)}${action.value.length > 30 ? '...' : ''}"` : '';

        return `
          <div class="action-item">
            <span class="action-type">${action.type}</span>
            <div class="action-details">${hintText}${valueText}</div>
          </div>
        `;
      })
      .join('');
  }
}

async function toggleRecording() {
  recordBtnEl.disabled = true;

  try {
    if (isRecording) {
      await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
    } else {
      // Clear previous actions when starting new recording
      await chrome.runtime.sendMessage({
        type: 'SET_STATE',
        payload: { recordedActions: [] }
      });
      await chrome.runtime.sendMessage({ type: 'START_RECORDING' });
    }
  } catch (error) {
    console.error('Failed to toggle recording:', error);
  } finally {
    recordBtnEl.disabled = false;
  }
}
