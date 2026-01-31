import { sendMessageSafe } from './messaging';
import { isContextValid } from '../../utils/context-check';
import { RecordingManager } from './recording';
import { PlaybackManager } from './playback';
import { initializeTriggers, handleTriggerMessage } from './triggers';
import { showAutoExecuteNotification, showCompletionNotification } from './triggers/inPageNotification';
import { PasswordCapture } from './recording/passwordCapture';

// Singleton instances
let recordingManager: RecordingManager | null = null;
let playbackManager: PlaybackManager | null = null;
let standaloneCapturer: PasswordCapture | null = null;

/**
 * Get or create the PlaybackManager singleton
 * Sets up event forwarding to sidepanel on first call
 */
function getPlaybackManager(): PlaybackManager {
  if (!playbackManager) {
    playbackManager = new PlaybackManager();
    playbackManager.onEvent((event) => {
      // Forward events to sidepanel
      const messageType = event.type === 'progress' ? 'EXECUTION_PROGRESS' :
                          event.type === 'auth_required' ? 'AUTH_REQUIRED' :
                          event.type === 'error' ? 'EXECUTION_FAILED' : 'STATE_CHANGED';
      chrome.runtime.sendMessage({
        type: messageType,
        payload: event
      }).catch(() => {}); // Ignore if no listener
    });
  }
  return playbackManager;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,

  main() {
    console.log('[Browserlet] Content script loaded on:', window.location.href);

    // Initialize recording manager
    recordingManager = new RecordingManager();

    // Set up event handler to forward actions to service worker
    recordingManager.onEvent(async (event) => {
      if (event.type === 'action_captured' && event.action) {
        try {
          await sendMessageSafe({
            type: 'ACTION_CAPTURED',
            payload: event.action
          });
        } catch (error) {
          console.error('[Browserlet] Failed to send action:', error);
        }
      }
    });

    // Verify communication with service worker on load
    verifyConnection();

    // Initialize trigger monitoring (async, don't block)
    initializeTriggers().catch(error => {
      console.warn('[Browserlet] Trigger initialization failed:', error);
    });

    // Listen for messages from service worker
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      handleServiceWorkerMessage(message)
        .then(sendResponse)
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true; // Will respond asynchronously
    });
  },
});

async function verifyConnection(): Promise<void> {
  try {
    const response = await sendMessageSafe({ type: 'PING' });
    if (response.success) {
      console.log('[Browserlet] Service worker connection verified');

      // Check if recording is already active (page refresh during recording)
      const stateResponse = await sendMessageSafe({ type: 'GET_STATE' });
      if (stateResponse.success && stateResponse.data) {
        const state = stateResponse.data as { recordingState?: string };
        if (state.recordingState === 'recording' && recordingManager) {
          console.log('[Browserlet] Resuming recording after page load');
          recordingManager.start();
        }
      }

      // Check for persisted execution state (resume after navigation)
      await checkAndResumeExecution();
    } else {
      console.warn('[Browserlet] Service worker responded with error:', response.error);
    }
  } catch (error) {
    console.error('[Browserlet] Failed to connect to service worker:', error);
  }
}

/**
 * Check for persisted execution state and resume if found
 * This handles cross-page navigation during script execution
 */
async function checkAndResumeExecution(): Promise<void> {
  try {
    const persistedState = await PlaybackManager.getPersistedState();

    if (persistedState) {
      console.log('[Browserlet] Found persisted execution state, resuming from step', persistedState.currentStep + 1);

      // Clear the persisted state immediately to prevent re-entry
      await PlaybackManager.clearPersistedState();

      // Wait a moment for the page to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get or create the PlaybackManager and resume execution
      const manager = getPlaybackManager();
      const result = await manager.execute(persistedState.yamlContent, {
        startStep: persistedState.currentStep,
        previousResults: persistedState.results,
      });

      // Send completion/failure message
      chrome.runtime.sendMessage({
        type: result.status === 'completed' ? 'EXECUTION_COMPLETED' : 'EXECUTION_FAILED',
        payload: result
      }).catch(() => {}); // Ignore if no listener
    }
  } catch (error) {
    console.error('[Browserlet] Error resuming execution:', error);
    // Clear state on error to prevent stuck executions
    await PlaybackManager.clearPersistedState();
  }
}

interface ServiceWorkerMessage {
  type: string;
  payload?: unknown;
}

async function handleServiceWorkerMessage(message: ServiceWorkerMessage): Promise<unknown> {
  // Check context validity before processing
  if (!isContextValid()) {
    return { success: false, error: 'Extension context invalidated' };
  }

  switch (message.type) {
    case 'PING':
      return { success: true, data: { status: 'ok', url: window.location.href } };

    case 'STORAGE_CHANGED':
      // Storage change notification from service worker
      console.log('[Browserlet] Storage changed:', message.payload);
      return { success: true };

    case 'START_RECORDING':
      if (recordingManager) {
        recordingManager.start();
        console.log('[Browserlet] Recording started');
      }
      return { success: true };

    case 'STOP_RECORDING':
      if (recordingManager) {
        const session = recordingManager.stop();
        console.log('[Browserlet] Recording stopped, actions:', session?.actions.length ?? 0);
      }
      return { success: true };

    case 'GET_CAPTURED_PASSWORDS':
      if (recordingManager) {
        const capturedPasswords = recordingManager.getCapturedPasswords();
        console.log('[Browserlet] Returning captured passwords:', capturedPasswords.length);
        return { success: true, data: capturedPasswords };
      }
      return { success: true, data: [] };

    case 'START_PASSWORD_CAPTURE':
      if (!standaloneCapturer) {
        standaloneCapturer = new PasswordCapture();
      }
      standaloneCapturer.start(() => {}); // callback not needed for standalone
      console.log('[Browserlet] Standalone password capture started');
      return { success: true };

    case 'STOP_PASSWORD_CAPTURE':
      if (standaloneCapturer) {
        const captured = standaloneCapturer.stop();
        standaloneCapturer = null;
        console.log('[Browserlet] Standalone capture stopped, got', captured.length, 'passwords');
        return { success: true, data: captured };
      }
      return { success: true, data: [] };

    case 'EXECUTE_SCRIPT': {
      const { content } = message.payload as { content: string };
      const manager = getPlaybackManager();
      // Execute async, send result when done
      manager.execute(content).then((result) => {
        chrome.runtime.sendMessage({
          type: result.status === 'completed' ? 'EXECUTION_COMPLETED' : 'EXECUTION_FAILED',
          payload: result
        }).catch(() => {}); // Ignore if no listener
      });
      console.log('[Browserlet] Script execution started');
      return { success: true };
    }

    case 'STOP_EXECUTION': {
      getPlaybackManager().stop();
      console.log('[Browserlet] Execution stopped');
      return { success: true };
    }

    case 'TRIGGERS_UPDATED':
      handleTriggerMessage(message);
      return { success: true };

    case 'STOP_TRIGGERS':
      handleTriggerMessage(message);
      return { success: true };

    case 'SHOW_AUTO_EXECUTE_NOTIFICATION': {
      const { scriptName, scriptId, url } = message.payload as {
        scriptName: string;
        scriptId: string;
        url: string;
      };
      showAutoExecuteNotification({
        scriptName,
        scriptId,
        onStop: () => {
          getPlaybackManager().stop();
          console.log('[Browserlet] Execution stopped via notification');
        },
        onDisableSite: async () => {
          try {
            await chrome.runtime.sendMessage({
              type: 'SET_SITE_OVERRIDE',
              payload: { scriptId, url, enabled: false }
            });
            console.log('[Browserlet] Site disabled for script:', scriptId);
          } catch (error) {
            console.error('[Browserlet] Failed to disable site:', error);
          }
        }
      });
      return { success: true };
    }

    case 'SHOW_COMPLETION_NOTIFICATION': {
      const { scriptName, success } = message.payload as {
        scriptName: string;
        success: boolean;
      };
      showCompletionNotification(scriptName, success);
      return { success: true };
    }

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}
