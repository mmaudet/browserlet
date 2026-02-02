import type { AppState, Message, MessageResponse, PingResponse, CapturedAction } from '../../utils/types';
import { getState, setState, setRecordingState, addRecordedAction, clearRecordedActions } from './storage';
import { getLLMService } from './llm';
import type { LLMConfig } from './llm/providers/types';
import { buildExtractionPrompt, parseExtractionResponse } from './llm/prompts/extractionPrompt';
import type { PageContext } from './llm/prompts/extractionPrompt';
import { buildHealingPrompt, parseHealingResponse } from './llm/prompts/healingPrompt';
import type { HealingPromptContext } from './llm/prompts/healingPrompt';
import type { SemanticHint } from '../content/playback/types';
import { getTriggerEngine, initializeTriggerEngine, broadcastTriggerUpdate } from './triggers';
import type { ContextState, TriggerConfig } from '../../utils/triggers/types';
import { getAllTriggers, saveTrigger, deleteTrigger, setSiteOverride } from '../../utils/storage/triggers';
import { handlePasswordMessage } from './passwords';
import { getScript, saveScript } from '../../utils/storage/scripts';
import { updateStepHints } from '../../utils/yaml/stepParser';
import { getHealingHistory, addHealingRecord } from '../../utils/storage/healing';

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

    // Self-healing selector messages
    case 'HEALING_REQUESTED': {
      const healingContext = message.payload as HealingPromptContext;
      const llmService = getLLMService();

      // Check if LLM is configured
      if (!llmService.isConfigured()) {
        console.warn('[Browserlet BG] HEALING_REQUESTED but LLM not configured');
        // Send error to sidepanel
        chrome.runtime.sendMessage({
          type: 'HEALING_ERROR',
          payload: { error: 'LLM not configured. Please configure an LLM provider in Settings.' }
        }).catch(() => {});
        return { success: false, error: 'LLM not configured' };
      }

      try {
        console.log('[Browserlet BG] Building healing prompt for step', healingContext.stepIndex);
        const prompt = buildHealingPrompt(healingContext);
        const response = await llmService.generate(prompt);
        const suggestions = parseHealingResponse(response);

        if (suggestions.length === 0) {
          console.warn('[Browserlet BG] No valid healing suggestions from LLM');
          chrome.runtime.sendMessage({
            type: 'HEALING_ERROR',
            payload: { error: 'LLM could not suggest alternative hints for this element.' }
          }).catch(() => {});
          return { success: false, error: 'No valid suggestions' };
        }

        // Send first suggestion to sidepanel
        // (Plan 03 will add UI to browse multiple suggestions)
        const bestSuggestion = suggestions[0];
        console.log('[Browserlet BG] Sending HEALING_SUGGESTION to sidepanel:', bestSuggestion);

        chrome.runtime.sendMessage({
          type: 'HEALING_SUGGESTION',
          payload: {
            stepIndex: healingContext.stepIndex,
            scriptId: (message.payload as { scriptId?: string }).scriptId || '',
            scriptName: (message.payload as { scriptName?: string }).scriptName || '',
            originalHints: healingContext.originalHints,
            proposedHints: bestSuggestion.proposedHints,
            confidence: bestSuggestion.confidence,
            reason: bestSuggestion.reason,
            domExcerpt: healingContext.domExcerpt,
            pageUrl: healingContext.pageUrl,
            pageTitle: healingContext.pageTitle,
          }
        }).catch(() => {});

        return { success: true, data: suggestions };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to generate healing suggestions';
        console.error('[Browserlet BG] HEALING_REQUESTED error:', errorMessage);
        chrome.runtime.sendMessage({
          type: 'HEALING_ERROR',
          payload: { error: errorMessage }
        }).catch(() => {});
        return { success: false, error: errorMessage };
      }
    }

    case 'APPLY_REPAIR': {
      const {
        repairId,
        stepIndex,
        newHints,
        scriptId,
        scriptName,
        originalHints,
        confidence,
        reason,
        pageUrl
      } = message.payload as {
        repairId: string;
        stepIndex: number;
        newHints: SemanticHint[];
        scriptId: string;
        scriptName: string;
        originalHints: SemanticHint[];
        confidence: number;
        reason: string;
        pageUrl: string;
      };

      console.log('[Browserlet BG] APPLY_REPAIR for step', stepIndex, 'repairId:', repairId);

      try {
        // Get the script
        const script = await getScript(scriptId);
        if (!script) {
          return { success: false, error: `Script not found: ${scriptId}` };
        }

        // Update the hints in the script content
        const updatedContent = updateStepHints(script.content, stepIndex, newHints);

        // Save the updated script
        await saveScript({
          ...script,
          content: updatedContent
        });

        console.log('[Browserlet BG] Script updated with healed hints');

        // Create healing record in audit trail
        await addHealingRecord({
          scriptId,
          scriptName,
          stepIndex,
          originalHints,
          newHints,
          confidence,
          reason,
          approvedBy: 'user',
          approvedAt: Date.now(),
          pageUrl
        });

        // Send HEALING_APPROVED to content script to hide overlay
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id) {
          await chrome.tabs.sendMessage(activeTab.id, {
            type: 'HEALING_APPROVED',
            payload: { repairId, stepIndex, newHints, scriptId }
          }).catch(() => {}); // Ignore if tab doesn't exist
        }

        return { success: true };
      } catch (error) {
        console.error('[Browserlet BG] Failed to apply repair:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `Failed to apply repair: ${errorMessage}` };
      }
    }

    case 'HEALING_REJECTED': {
      const { repairId } = message.payload as { repairId: string };
      console.log('[Browserlet BG] HEALING_REJECTED for repairId:', repairId);

      // TODO: Plan 04 may log rejection to healing history
      // For now, just acknowledge - the sidepanel handles queue removal
      return { success: true };
    }

    case 'GET_HEALING_HISTORY': {
      const { scriptId } = message.payload as { scriptId: string };
      console.log('[Browserlet BG] GET_HEALING_HISTORY for script:', scriptId);
      const history = await getHealingHistory(scriptId);
      return { success: true, data: history };
    }

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}
