import type { AppState, Message, MessageResponse, PingResponse, CapturedAction } from '../../utils/types';
import { storage } from '../../utils/storage/browserCompat';
import { getState, setState, setRecordingState, addRecordedAction, clearRecordedActions } from './storage';
import { getLLMService } from './llm';
import type { LLMConfig } from './llm/providers/types';
import { buildExtractionPrompt, parseExtractionResponse } from './llm/prompts/extractionPrompt';
import type { PageContext } from './llm/prompts/extractionPrompt';
import { getTriggerEngine, initializeTriggerEngine, broadcastTriggerUpdate } from './triggers';
import type { ContextState, TriggerConfig } from '../../utils/triggers/types';
import { getAllTriggers, saveTrigger, deleteTrigger, setSiteOverride } from '../../utils/storage/triggers';
import { handlePasswordMessage } from './passwords';
import { saveScreenshot, getScreenshots, deleteScreenshot } from '../../utils/storage/screenshots';
import { captureSession, getSessionStatus, clearSession } from './sessions';
import { restoreSession } from './sessionRestore';

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
      await storage.local.set({ [EXECUTION_STATE_KEY]: state });
      console.log('[Browserlet] Saved execution state, resuming at step', state.currentStep);
      return { success: true };
    }

    case 'GET_EXECUTION_STATE': {
      const data = await storage.local.get(EXECUTION_STATE_KEY);
      const state = data[EXECUTION_STATE_KEY] as PersistedExecutionState | undefined;

      if (!state) {
        return { success: true, data: null };
      }

      // Check if state is stale (more than 30 seconds old)
      if (Date.now() - state.timestamp > 30000) {
        await storage.local.remove(EXECUTION_STATE_KEY);
        return { success: true, data: null };
      }

      return { success: true, data: state };
    }

    case 'CLEAR_EXECUTION_STATE': {
      await storage.local.remove(EXECUTION_STATE_KEY);
      return { success: true };
    }

    case 'GENERATE_BSL': {
      const { actions, startUrl } = message.payload as { actions: CapturedAction[]; startUrl?: string };
      const llmService = getLLMService();
      try {
        const result = await llmService.generateBSL(actions, startUrl);
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

    case 'MICRO_PROMPT_REQUEST': {
      const { routeMicroPrompt } = await import('./llm/microPromptRouter');
      const request = message.payload as { promptType: string; input: unknown };
      try {
        const result = await routeMicroPrompt(request as import('./llm/microPromptRouter').MicroPromptRequest);
        if (result.success) {
          return { success: true, data: result };
        } else {
          return { success: false, error: result.error };
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown micro-prompt error';
        return { success: false, error: errorMessage };
      }
    }

    case 'SUGGEST_EXTRACTIONS': {
      const pageContext = message.payload as PageContext;
      const llmService = getLLMService();

      // Check if LLM is configured
      if (!llmService.isConfigured()) {
        return { success: false, error: 'LLM not configured' };
      }

      try {
        const prompt = buildExtractionPrompt(pageContext);
        const response = await llmService.generate(prompt);
        const suggestions = parseExtractionResponse(response);
        return { success: true, data: suggestions };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate suggestions';
        return { success: false, error: errorMessage };
      }
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
      // Get tab ID from sender (if from content script) or from active tab (if from sidepanel)
      let tabId = _sender.tab?.id;
      if (!tabId) {
        // Message from sidepanel - query active tab
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = activeTab?.id;
      }
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
    case 'DELETE_PASSWORD':
    case 'SUBSTITUTE_CREDENTIALS': {
      const result = await handlePasswordMessage(message.type, message.payload);
      return result;
    }

    // Screenshot messages
    case 'CAPTURE_SCREENSHOT': {
      console.log('[Browserlet BG] CAPTURE_SCREENSHOT received:', message.payload);
      const { scriptId, executionId, stepIndex, isFailure, failureReason, pageUrl, pageTitle } =
        message.payload as {
          scriptId: string;
          executionId?: string;
          stepIndex: number;
          isFailure: boolean;
          failureReason?: string;
          pageUrl: string;
          pageTitle: string;
        };

      try {
        // Get active tab and capture visible area
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !tab.windowId) {
          return { success: false, error: 'No active tab' };
        }

        // Capture as PNG (lossless, per user preference SHOT-06)
        const dataUrl = await chrome.tabs.captureVisibleTab(
          tab.windowId,
          { format: 'png' }
        );

        // Save to storage
        console.log('[Browserlet BG] Saving screenshot for script:', scriptId, 'step:', stepIndex);
        await saveScreenshot({
          scriptId,
          executionId,
          stepIndex,
          timestamp: Date.now(),
          pageUrl,
          pageTitle,
          isFailure,
          failureReason,
          dataUrl
        });

        console.log('[Browserlet BG] Screenshot saved successfully');
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Capture failed';
        console.error('[Browserlet BG] Screenshot capture error:', msg);
        return { success: false, error: msg };
      }
    }

    case 'GET_SCREENSHOTS': {
      const { scriptId } = message.payload as { scriptId: string };
      const screenshots = await getScreenshots(scriptId);
      return { success: true, data: screenshots };
    }

    case 'DELETE_SCREENSHOT': {
      const { scriptId, screenshotId } = message.payload as { scriptId: string; screenshotId: string };
      await deleteScreenshot(scriptId, screenshotId);
      return { success: true };
    }

    // Session persistence messages (Phase 33)
    case 'CAPTURE_SESSION': {
      const { scriptId, tabId } = message.payload as {
        scriptId: string;
        tabId: number;
      };
      try {
        await captureSession(scriptId, tabId);
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Session capture failed';
        console.error('[Browserlet BG] CAPTURE_SESSION error:', msg);
        return { success: false, error: msg };
      }
    }

    case 'GET_SESSION_STATUS': {
      const { scriptId, domain } = message.payload as {
        scriptId: string;
        domain: string;
      };
      try {
        const status = await getSessionStatus(scriptId, domain);
        return { success: true, data: status };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Session status check failed';
        console.error('[Browserlet BG] GET_SESSION_STATUS error:', msg);
        return { success: false, error: msg };
      }
    }

    case 'CLEAR_SESSION': {
      const { scriptId, domain } = message.payload as {
        scriptId: string;
        domain: string;
      };
      try {
        await clearSession(scriptId, domain);
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Session clear failed';
        console.error('[Browserlet BG] CLEAR_SESSION error:', msg);
        return { success: false, error: msg };
      }
    }

    case 'RESTORE_SESSION': {
      const { scriptId, domain, tabId } = message.payload as {
        scriptId: string;
        domain: string;
        tabId: number;
      };
      try {
        const restored = await restoreSession(scriptId, domain, tabId);
        return { success: true, data: { restored } };
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Session restoration failed';
        console.error('[Browserlet BG] RESTORE_SESSION error:', msg);
        return { success: false, error: msg };
      }
    }

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}
