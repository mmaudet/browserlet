import type { AppState, Message, MessageResponse, PingResponse, CapturedAction } from '../../utils/types';
import { getState, setState, setRecordingState, addRecordedAction, clearRecordedActions } from './storage';
import { getLLMService } from './llm';
import type { LLMConfig } from './llm/providers/types';
import { getTriggerEngine, initializeTriggerEngine, broadcastTriggerUpdate } from './triggers';
import type { ContextState, TriggerConfig } from '../../utils/triggers/types';
import { getAllTriggers, saveTrigger, deleteTrigger, setSiteOverride } from '../../utils/storage/triggers';
import { handlePasswordMessage } from './passwords';

// Storage key for persisted execution state
const EXECUTION_STATE_KEY = 'browserlet_execution_state';

// Type for persisted execution state
interface PersistedExecutionState {
  yamlContent: string;
  currentStep: number;
  results: Record<string, unknown>;
  timestamp: number;
}

export function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
): boolean {
  processMessage(message, sender)
    .then(sendResponse)
    .catch((error: Error) => sendResponse({ success: false, error: error.message }));

  return true; // Keep channel open for async response
}

async function processMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender
): Promise<MessageResponse> {
  switch (message.type) {
    case 'PING':
      return {
        success: true,
        data: { status: 'ok', timestamp: Date.now() } as PingResponse,
      };

    case 'GET_STATE': {
      const state = await getState();
      return { success: true, data: state };
    }

    case 'SET_STATE': {
      const updated = await setState(message.payload as Partial<AppState>);
      return { success: true, data: updated };
    }

    case 'START_RECORDING': {
      // Clear previous recorded actions before starting new recording
      await clearRecordedActions();

      // Update state
      const updated = await setRecordingState('recording');

      // Broadcast to all tabs to start recording
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' });
          } catch {
            // Tab might not have content script
          }
        }
      }

      return { success: true, data: updated };
    }

    case 'STOP_RECORDING': {
      const updated = await setRecordingState('idle');

      // Broadcast to all tabs to stop recording
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id) {
          try {
            await chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' });
          } catch {
            // Tab might not have content script
          }
        }
      }

      return { success: true, data: updated };
    }

    case 'ACTION_CAPTURED': {
      const action = message.payload as CapturedAction;
      await addRecordedAction(action);
      return { success: true };
    }

    case 'SAVE_EXECUTION_STATE': {
      const state = message.payload as PersistedExecutionState;
      await chrome.storage.local.set({ [EXECUTION_STATE_KEY]: state });
      console.log('[Browserlet] Saved execution state, resuming at step', state.currentStep);
      return { success: true };
    }

    case 'GET_EXECUTION_STATE': {
      const data = await chrome.storage.local.get(EXECUTION_STATE_KEY);
      const state = data[EXECUTION_STATE_KEY] as PersistedExecutionState | undefined;

      if (!state) {
        return { success: true, data: null };
      }

      // Check if state is stale (more than 30 seconds old)
      if (Date.now() - state.timestamp > 30000) {
        await chrome.storage.local.remove(EXECUTION_STATE_KEY);
        return { success: true, data: null };
      }

      return { success: true, data: state };
    }

    case 'CLEAR_EXECUTION_STATE': {
      await chrome.storage.local.remove(EXECUTION_STATE_KEY);
      return { success: true };
    }

    case 'GENERATE_BSL': {
      const { actions } = message.payload as { actions: CapturedAction[] };
      const llmService = getLLMService();
      try {
        const result = await llmService.generateBSL(actions);
        return { success: true, data: result }; // { bsl: string, usedLLM: boolean }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    }

    case 'CONFIGURE_LLM': {
      const config = message.payload as LLMConfig;
      const llmService = getLLMService();
      try {
        await llmService.initialize(config);
        return { success: true };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
      }
    }

    case 'GET_LLM_STATUS': {
      const llmService = getLLMService();
      const status = llmService.getStatus();
      return { success: true, data: status };
    }

    case 'CONTEXT_MATCH': {
      const context = message.payload as ContextState;
      const tabId = _sender.tab?.id;
      console.log('[Browserlet BG] CONTEXT_MATCH received, tabId:', tabId, 'matches:', context.matches);
      if (tabId) {
        try {
          await getTriggerEngine().handleContextMatch(tabId, context);
          console.log('[Browserlet BG] handleContextMatch completed');
        } catch (error) {
          console.error('[Browserlet BG] handleContextMatch error:', error);
        }
      }
      return { success: true };
    }

    case 'GET_TRIGGERS': {
      // Ensure trigger engine is initialized before returning triggers
      // Handles race condition where content script requests before background ready
      await initializeTriggerEngine();
      const triggers = await getAllTriggers();
      return { success: true, data: triggers };
    }

    case 'SAVE_TRIGGER': {
      const trigger = message.payload as TriggerConfig;
      await saveTrigger(trigger);
      await broadcastTriggerUpdate();
      return { success: true };
    }

    case 'DELETE_TRIGGER': {
      const triggerId = message.payload as string;
      await deleteTrigger(triggerId);
      await broadcastTriggerUpdate();
      return { success: true };
    }

    case 'GET_SUGGESTED_SCRIPTS': {
      const tabId = _sender.tab?.id;
      if (tabId) {
        const scriptIds = await getTriggerEngine().getSuggestedScripts(tabId);
        return { success: true, data: scriptIds };
      }
      return { success: true, data: [] };
    }

    case 'SET_SITE_OVERRIDE': {
      const { scriptId, url, enabled } = message.payload as {
        scriptId: string;
        url: string;
        enabled: boolean;
      };
      await setSiteOverride(scriptId, url, enabled);
      return { success: true };
    }

    case 'GET_CAPTURED_PASSWORDS': {
      // Forward to active tab's content script to get captured passwords
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        try {
          const response = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_CAPTURED_PASSWORDS' });
          console.log('[Browserlet BG] GET_CAPTURED_PASSWORDS from tab', activeTab.id, ':', response);
          return response;
        } catch (error) {
          console.error('[Browserlet BG] Failed to get captured passwords from tab:', error);
          return { success: true, data: [] };
        }
      }
      return { success: true, data: [] };
    }

    // Password-related messages
    case 'GET_VAULT_STATE':
    case 'UNLOCK_VAULT':
    case 'LOCK_VAULT':
    case 'GET_PASSWORDS':
    case 'SAVE_PASSWORD':
    case 'SAVE_PASSWORDS':
    case 'DELETE_PASSWORD': {
      const result = await handlePasswordMessage(message.type, message.payload);
      return result;
    }

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}
