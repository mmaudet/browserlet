import { signal } from '@preact/signals';
import { storage } from '../../../utils/storage/browserCompat';
import { useEffect } from 'preact/hooks';
import { Sparkles, Camera } from 'lucide-preact';
import { llmConfigStore, getLLMConfigForServiceWorker, loadLLMConfig, isConfigValid } from '../stores/llmConfig';
import { loadScripts } from '../stores/scripts';
import { navigateTo } from '../router';
import { saveScript } from '../../../utils/storage/scripts';
import { PasswordPrompt, promptForPasswords } from './PasswordPrompt';
import { AIExtractionSuggestions } from './AIExtractionSuggestions';
import type { DetectedPassword } from '../../../utils/passwords/types';
import type { ExtractionSuggestion } from '../../background/llm/prompts/extractionPrompt';
import { isFirefox } from '../../../utils/browser-detect';

// Recording state (synced with storage)
export const isRecording = signal(false);
export const recordedActions = signal<Array<{
  type: string;
  timestamp: number;
  url: string;
  hints: Array<{ type: string; value: unknown }>;
  value?: string;
  output?: { variable: string; transform?: string };
}>>([]);

// BSL generation state
const isGeneratingBSL = signal(false);
const generationStatus = signal<{ type: 'success' | 'error' | 'info'; message: string; usedLLM?: boolean } | null>(null);

// AI extraction state
const showExtractionUI = signal(false);
const extractionSuggestions = signal<ExtractionSuggestion[]>([]);
const isAnalyzing = signal(false);

// Load state from storage
async function loadRecordingState(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (response.success && response.data) {
      isRecording.value = response.data.recordingState === 'recording';
      recordedActions.value = response.data.recordedActions || [];
    }
  } catch (error) {
    console.error('Failed to load recording state:', error);
  }
}

/**
 * Generate basic BSL locally without LLM (fallback mode)
 */
function generateBasicBSL(actions: typeof recordedActions.value, startUrl?: string): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  let scriptName = `Recording ${timestamp}`;

  // Try to extract domain from startUrl or first navigate action
  const urlToUse = startUrl || actions.find(a => a.type === 'navigate')?.url;
  if (urlToUse) {
    try {
      const url = new URL(urlToUse);
      scriptName = `Recording - ${url.hostname}`;
    } catch {
      // Keep default name
    }
  }

  const steps = [];

  // Prepend navigate to startUrl if provided
  if (startUrl) {
    steps.push({
      action: 'navigate',
      url: startUrl
    });
  }

  const targetRequiredActions = ['click', 'type', 'select', 'extract', 'table_extract', 'wait_for', 'scroll', 'hover'];

  const actionSteps = actions.reduce<Record<string, unknown>[]>((result, action) => {
    // Map internal action types to valid BSL actions
    const bslAction = action.type === 'input' ? 'type'
                    : action.type === 'submit' ? 'click'
                    : action.type;
    const step: Record<string, unknown> = { action: bslAction };

    // Add URL for navigate actions
    if (action.type === 'navigate' && action.url) {
      step.url = action.url;
      result.push(step);
      return result;
    }

    // Add target with hints array (BSL format)
    if (action.hints && action.hints.length > 0) {
      step.target = {
        hints: action.hints.slice(0, 3).map(hint => ({
          type: hint.type,
          value: hint.value
        }))
      };
    } else if (targetRequiredActions.includes(bslAction)) {
      // Skip actions that require a target but have no hints — they can't be replayed
      return result;
    }

    // Add value for input actions
    if (action.value !== undefined) {
      step.value = action.value;
    }

    // Add output for extract actions
    const actionWithOutput = action as typeof action & { output?: { variable: string; transform?: string } };
    if ((action.type === 'extract' || action.type === 'table_extract') && actionWithOutput.output) {
      step.output = actionWithOutput.output;
    }

    result.push(step);
    return result;
  }, []);

  steps.push(...actionSteps);

  // Convert to YAML manually (simple format)
  const yamlLines = [
    `name: "${scriptName}"`,
    'version: "1.0.0"',
    'description: "Auto-generated from recording"',
    'steps:'
  ];

  steps.forEach(step => {
    yamlLines.push(`  - action: ${step.action}`);
    if (step.url) {
      yamlLines.push(`    url: "${step.url}"`);
    }
    if (step.target) {
      yamlLines.push('    target:');
      const target = step.target as { hints?: Array<{ type: string; value: unknown }> };
      if (target.hints && Array.isArray(target.hints)) {
        yamlLines.push('      hints:');
        target.hints.forEach(hint => {
          yamlLines.push(`        - type: ${hint.type}`);
          if (typeof hint.value === 'string') {
            yamlLines.push(`          value: "${hint.value}"`);
          } else {
            yamlLines.push(`          value: ${JSON.stringify(hint.value)}`);
          }
        });
      }
    }
    if (step.value !== undefined) {
      yamlLines.push(`    value: "${step.value}"`);
    }
    // Add output for extract actions
    if (step.output) {
      const output = step.output as { variable: string; transform?: string };
      yamlLines.push('    output:');
      yamlLines.push(`      variable: ${output.variable}`);
      if (output.transform) {
        yamlLines.push(`      transform: ${output.transform}`);
      }
    }
  });

  return yamlLines.join('\n');
}

/**
 * Generate BSL from recorded actions - tries LLM first, falls back to basic
 */
async function generateBSL(actions: typeof recordedActions.value, startUrl?: string): Promise<{ bsl: string; usedLLM: boolean }> {
  // Reload config from storage to ensure we have latest state
  try {
    await loadLLMConfig();
  } catch (error) {
    console.error('Failed to load LLM config:', error);
  }

  // Check if LLM is configured and valid
  const configured = llmConfigStore.isConfigured.value && isConfigValid();
  console.log('[Browserlet] LLM check - isConfigured:', llmConfigStore.isConfigured.value, 'isValid:', isConfigValid(), 'provider:', llmConfigStore.provider.value);

  if (!configured) {
    console.log('[Browserlet] LLM not configured, using basic generation');
    return { bsl: generateBasicBSL(actions, startUrl), usedLLM: false };
  }

  try {
    // Ensure LLM service is configured with current settings
    const config = getLLMConfigForServiceWorker();
    console.log('[Browserlet] Configuring LLM service with:', { provider: config.provider, hasApiKey: !!config.claudeApiKey });
    await chrome.runtime.sendMessage({ type: 'CONFIGURE_LLM', payload: config });

    // Send GENERATE_BSL message to service worker
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_BSL',
      payload: { actions, startUrl }
    });

    if (response.success && response.data) {
      return response.data as { bsl: string; usedLLM: boolean };
    } else {
      console.error('GENERATE_BSL failed:', response.error);
      // Fall back to basic generation
      return { bsl: generateBasicBSL(actions, startUrl), usedLLM: false };
    }
  } catch (error) {
    console.error('Error generating BSL with LLM:', error);
    // Fall back to basic generation
    return { bsl: generateBasicBSL(actions, startUrl), usedLLM: false };
  }
}

/**
 * Extract script name from BSL content
 */
function extractScriptName(bsl: string): string {
  const nameMatch = bsl.match(/^name:\s*["']?([^"'\n]+)["']?/m);
  return nameMatch?.[1]?.trim() ?? `Recording ${new Date().toISOString().slice(0, 10)}`;
}

export async function toggleRecording(): Promise<void> {
  try {
    if (isRecording.value) {
      // Stop recording
      await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });

      // Get final recorded actions
      const stateResponse = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      const actions = stateResponse.success && stateResponse.data?.recordedActions
        ? stateResponse.data.recordedActions
        : recordedActions.value;

      // Check for captured passwords from the active tab
      let capturedPasswords: DetectedPassword[] = [];
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('[Browserlet] Active tab for password check:', activeTab?.id, activeTab?.url);
        if (activeTab?.id) {
          const passwordResponse = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_CAPTURED_PASSWORDS' });
          console.log('[Browserlet] Password response:', JSON.stringify(passwordResponse));
          if (passwordResponse.success && passwordResponse.data) {
            capturedPasswords = passwordResponse.data as DetectedPassword[];
            console.log('[Browserlet] Captured passwords:', capturedPasswords.length);
          }
        }
      } catch (error) {
        // Content script might not be available, continue without passwords
        console.warn('[Browserlet] Could not get captured passwords:', error);
      }

      // If passwords were captured, show the password prompt and wait for user decision
      if (capturedPasswords.length > 0) {
        console.log('[Browserlet] Showing password prompt for', capturedPasswords.length, 'passwords');
        const saved = await promptForPasswords(capturedPasswords);
        console.log('[Browserlet] Password prompt result:', saved ? 'saved' : 'skipped');
      }

      if (actions.length === 0) {
        generationStatus.value = {
          type: 'info',
          message: chrome.i18n.getMessage('noActionsYet') || 'No actions to generate script from'
        };
        return;
      }

      // Extract startUrl from first action
      const startUrl = actions.length > 0 ? actions[0]?.url : undefined;

      // Generate BSL
      isGeneratingBSL.value = true;
      generationStatus.value = {
        type: 'info',
        message: chrome.i18n.getMessage('generatingBSL') || 'Generating script...'
      };

      try {
        const { bsl, usedLLM } = await generateBSL(actions, startUrl);

        // Extract script name from generated BSL
        const scriptName = extractScriptName(bsl);

        // Create and save new script
        const script = await saveScript({
          name: scriptName,
          version: '1.0.0',
          content: bsl
        });

        // Reload scripts to update the list
        await loadScripts();

        // Show success status
        generationStatus.value = {
          type: 'success',
          message: usedLLM
            ? (chrome.i18n.getMessage('generatedWithLLM') || 'Generated with LLM')
            : (chrome.i18n.getMessage('generatedBasic') || 'Generated (basic mode)'),
          usedLLM
        };

        // Navigate to editor with new script
        navigateTo('editor', script);
      } catch (error) {
        console.error('Failed to generate/save script:', error);
        generationStatus.value = {
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to generate script'
        };
      } finally {
        isGeneratingBSL.value = false;
      }
    } else {
      // Start recording - clear previous state
      generationStatus.value = null;

      // First, check if we can communicate with the active tab
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab?.id && activeTab.url) {
          // Check if this is a valid page (not chrome://, extension://, etc.)
          const url = activeTab.url;
          if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
              url.startsWith('edge://') || url.startsWith('about:') ||
              url.startsWith('file://') && url.endsWith('.pdf')) {
            generationStatus.value = {
              type: 'error',
              message: chrome.i18n.getMessage('recordingNotAvailable') ||
                'Recording not available on this page (browser pages, PDFs, or extensions are not supported)'
            };
            return;
          }

          try {
            await chrome.tabs.sendMessage(activeTab.id, { type: 'PING' });
          } catch {
            // Content script not loaded - try to inject it
            if (!isFirefox) {
              // Chrome: use scripting API to inject content script
              console.log('[Browserlet] Content script not found, attempting to inject...');
              try {
                await chrome.scripting.executeScript({
                  target: { tabId: activeTab.id },
                  files: ['content-scripts/content.js']
                });
                // Wait a bit for the script to initialize
                await new Promise(resolve => setTimeout(resolve, 500));
                // Try PING again
                await chrome.tabs.sendMessage(activeTab.id, { type: 'PING' });
                console.log('[Browserlet] Content script injected successfully');
              } catch (injectError) {
                console.error('[Browserlet] Failed to inject content script:', injectError);
                generationStatus.value = {
                  type: 'error',
                  message: chrome.i18n.getMessage('recordingNotAvailable') ||
                    'Recording not available on this page (browser pages, PDFs, or extensions are not supported)'
                };
                return;
              }
            } else {
              // Firefox: scripting API unavailable, content scripts are auto-injected via manifest
              console.log('[Browserlet] Firefox: content script not responding, asking user to refresh');
              generationStatus.value = {
                type: 'error',
                message: chrome.i18n.getMessage('contentScriptNotLoaded') ||
                  'Content script not loaded. Please refresh the page and try again.'
              };
              return;
            }
          }
        }
      } catch (error) {
        console.warn('Could not check active tab:', error);
        // Continue anyway - the service worker will broadcast to all tabs
      }

      await chrome.runtime.sendMessage({
        type: 'SET_STATE',
        payload: { recordedActions: [] }
      });
      await chrome.runtime.sendMessage({ type: 'START_RECORDING' });
    }
  } catch (error) {
    console.error('Failed to toggle recording:', error);
  }
}

interface ActionItemProps {
  action: typeof recordedActions.value[0];
}

function ActionItem({ action }: ActionItemProps) {
  const hint = action.hints[0];
  const hintText = hint
    ? `${hint.type}: ${typeof hint.value === 'string' ? hint.value : JSON.stringify(hint.value)}`
    : '';
  const valueText = action.value
    ? ` = "${action.value.substring(0, 30)}${action.value.length > 30 ? '...' : ''}"`
    : '';

  return (
    <div style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>
      <span style={{ fontWeight: 500, color: '#333', textTransform: 'uppercase', fontSize: '10px' }}>
        {action.type}
      </span>
      <div style={{ marginTop: '4px', fontSize: '12px', color: '#888', wordBreak: 'break-all' }}>
        {hintText + valueText}
      </div>
    </div>
  );
}

function StatusMessage() {
  const status = generationStatus.value;
  if (!status) return null;

  const styles: Record<string, string> = {
    success: 'background: #d4edda; border: 1px solid #c3e6cb; color: #155724;',
    error: 'background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24;',
    info: 'background: #e7f3ff; border: 1px solid #b6d4fe; color: #084298;'
  };

  return (
    <div style={{ padding: '10px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px', ...parseStyleString(styles[status.type]) }}>
      {status.message}
      {status.usedLLM !== undefined && (
        <div style={{ marginTop: '4px', fontSize: '11px', opacity: 0.8 }}>
          {status.usedLLM
            ? (chrome.i18n.getMessage('llmConfigured') || 'Using configured LLM provider')
            : (chrome.i18n.getMessage('llmNotConfigured') || 'LLM not configured - using basic generation')
          }
        </div>
      )}
    </div>
  );
}

// Helper to convert CSS string to style object
function parseStyleString(styleString: string): Record<string, string> {
  const style: Record<string, string> = {};
  if (!styleString) return style;
  styleString.split(';').forEach(rule => {
    const [key, value] = rule.split(':').map(s => s.trim());
    if (key && value) {
      // Convert kebab-case to camelCase
      const camelKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      style[camelKey] = value;
    }
  });
  return style;
}

function LoadingIndicator() {
  if (!isGeneratingBSL.value) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '16px',
      background: '#f5f5f5',
      borderRadius: '8px',
      marginBottom: '12px'
    }}>
      <div style={{
        width: '16px',
        height: '16px',
        border: '2px solid #ddd',
        borderTopColor: '#4285f4',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <span style={{ color: '#666', fontSize: '13px' }}>
        {chrome.i18n.getMessage('generatingBSL') || 'Generating script...'}
      </span>
    </div>
  );
}

/**
 * Handle clicking "Extract This Page" button
 * Gets page context from content script and requests AI suggestions
 */
async function handleExtractPage(): Promise<void> {
  showExtractionUI.value = true;
  isAnalyzing.value = true;
  extractionSuggestions.value = [];

  try {
    // First, ensure LLM is configured
    const config = getLLMConfigForServiceWorker();
    await chrome.runtime.sendMessage({ type: 'CONFIGURE_LLM', payload: config });

    // Get active tab and request page context
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) throw new Error('No active tab');

    const contextResponse = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_PAGE_CONTEXT' });
    if (!contextResponse.success) throw new Error('Failed to get page context');

    // Request AI suggestions
    const suggestionsResponse = await chrome.runtime.sendMessage({
      type: 'SUGGEST_EXTRACTIONS',
      payload: contextResponse.data
    });

    if (suggestionsResponse.success) {
      extractionSuggestions.value = suggestionsResponse.data || [];
    } else {
      console.error('[Browserlet] AI suggestions failed:', suggestionsResponse.error);
      extractionSuggestions.value = [];
    }
  } catch (error) {
    console.error('[Browserlet] Extract page failed:', error);
    extractionSuggestions.value = [];
  } finally {
    isAnalyzing.value = false;
  }
}

/**
 * Handle user accepting AI extraction suggestions
 * Converts suggestions to extract actions and adds them to recording
 */
async function handleAcceptSuggestions(selected: ExtractionSuggestion[]): Promise<void> {
  // Convert suggestions to recorded actions
  // Use table_extract for tables, extract for single values
  const extractActions = selected.map(s => ({
    type: s.isTable ? 'table_extract' : 'extract',
    timestamp: Date.now(),
    url: '', // Will be filled from current page during playback
    hints: s.semanticHints.map(h => ({ type: h.type, value: h.value })),
    output: {
      variable: `extracted.${s.variableName}`,
      transform: s.suggestedTransform
    }
  }));

  // Add to local state
  recordedActions.value = [...recordedActions.value, ...extractActions];

  // Sync to background storage so they're included when recording stops
  for (const action of extractActions) {
    try {
      await chrome.runtime.sendMessage({
        type: 'ACTION_CAPTURED',
        payload: action
      });
    } catch (error) {
      console.error('[Browserlet] Failed to sync extract action to background:', error);
    }
  }

  // Close UI
  showExtractionUI.value = false;
  extractionSuggestions.value = [];
}

/**
 * Handle clicking "Take Screenshot" button
 * Adds a screenshot action to the recorded action list
 */
async function handleTakeScreenshot(): Promise<void> {
  const screenshotAction = {
    type: 'screenshot',
    timestamp: Date.now(),
    url: '',
    hints: []
  };

  // Add to local state
  recordedActions.value = [...recordedActions.value, screenshotAction];

  // Sync to background storage
  try {
    await chrome.runtime.sendMessage({
      type: 'ACTION_CAPTURED',
      payload: screenshotAction
    });
  } catch (error) {
    console.error('[Browserlet] Failed to sync screenshot action to background:', error);
  }
}

function LLMStatusIndicator() {
  if (isGeneratingBSL.value || generationStatus.value) {
    return null;
  }

  const configured = llmConfigStore.isConfigured.value && isConfigValid();
  const provider = llmConfigStore.provider.value;
  const needsApiKey = llmConfigStore.needsApiKey.value;

  if (configured) {
    const providerName = provider === 'openai' ? 'OpenAI Compatible' :
                         provider === 'claude' ? 'Claude (Anthropic)' : 'Ollama';
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: '#e8f5e9',
        border: '1px solid #c8e6c9',
        padding: '8px 12px',
        borderRadius: '6px',
        marginBottom: '12px',
        fontSize: '12px',
        color: '#2e7d32'
      }}>
        <span style={{ width: '8px', height: '8px', background: '#4caf50', borderRadius: '50%' }} />
        <span>
          {chrome.i18n.getMessage('llmActive') || `LLM active: ${providerName}`}
        </span>
      </div>
    );
  } else if (needsApiKey) {
    // API key exists but can't be decrypted (session expired)
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: '#fff3cd',
        border: '1px solid #ffc107',
        padding: '8px 12px',
        borderRadius: '6px',
        marginBottom: '12px',
        fontSize: '12px',
        color: '#856404'
      }}>
        <span style={{ width: '8px', height: '8px', background: '#ff9800', borderRadius: '50%' }} />
        <span>
          {chrome.i18n.getMessage('llmNeedsApiKey') || 'API key expired - please re-enter in Settings'}
        </span>
      </div>
    );
  } else {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: '#fff3cd',
        border: '1px solid #ffc107',
        padding: '8px 12px',
        borderRadius: '6px',
        marginBottom: '12px',
        fontSize: '12px',
        color: '#856404'
      }}>
        <span style={{ width: '8px', height: '8px', background: '#ff9800', borderRadius: '50%' }} />
        <span>
          {chrome.i18n.getMessage('llmNotConfiguredShort') || 'Basic mode (LLM not configured)'}
        </span>
      </div>
    );
  }
}

export function RecordingView() {
  // Load initial state and LLM config on mount
  useEffect(() => {
    loadRecordingState();
    loadLLMConfig().catch(console.error);

    // Add CSS for animations if not present
    if (!document.getElementById('recording-view-styles')) {
      const style = document.createElement('style');
      style.id = 'recording-view-styles';
      style.textContent = `
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `;
      document.head.appendChild(style);
    }

    // Listen for state changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && changes.appState) {
        const state = changes.appState.newValue as {
          recordingState?: string;
          recordedActions?: typeof recordedActions.value;
        } | undefined;
        isRecording.value = state?.recordingState === 'recording';
        recordedActions.value = state?.recordedActions || [];
      }
    };

    storage.onChanged.addListener(handleStorageChange);

    return () => {
      storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  return (
    <div style={{ padding: '16px' }}>
      {/* Recording status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontWeight: 500 }}>
          {chrome.i18n.getMessage('recording') || 'Recording'}
        </span>
        <span style={{
          fontSize: '12px',
          padding: '4px 8px',
          borderRadius: '4px',
          background: isRecording.value ? '#ffebee' : '#e8f5e9',
          color: isRecording.value ? '#c62828' : '#2e7d32'
        }}>
          {isRecording.value
            ? chrome.i18n.getMessage('recordingActive') || 'Recording...'
            : chrome.i18n.getMessage('idle') || 'Idle'
          }
        </span>
      </div>

      {/* Loading indicator */}
      <LoadingIndicator />

      {/* Status message */}
      <StatusMessage />

      {/* LLM status indicator */}
      <LLMStatusIndicator />

      {/* Record button */}
      <button
        style={{
          width: '100%',
          padding: '12px',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: isGeneratingBSL.value ? 'not-allowed' : 'pointer',
          marginBottom: '12px',
          background: isGeneratingBSL.value
            ? '#ccc'
            : isRecording.value
              ? '#f44336'
              : '#4285f4',
          color: isGeneratingBSL.value ? '#666' : 'white'
        }}
        disabled={isGeneratingBSL.value}
        onClick={() => !isGeneratingBSL.value && toggleRecording()}
      >
        {isGeneratingBSL.value
          ? chrome.i18n.getMessage('generatingBSL') || 'Generating...'
          : isRecording.value
            ? chrome.i18n.getMessage('stopRecording') || 'Stop Recording'
            : chrome.i18n.getMessage('startRecording') || 'Start Recording'
        }
      </button>

      {/* Extract This Page button (only visible during recording and when LLM configured) */}
      {isRecording.value && llmConfigStore.isConfigured.value && isConfigValid() && (
        <button
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            marginBottom: '16px',
            background: 'white',
            color: '#333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onClick={handleExtractPage}
          title={chrome.i18n.getMessage('extractThisPage') || 'Extract data from this page'}
        >
          <Sparkles size={16} style={{ color: '#4285f4' }} />
          {chrome.i18n.getMessage('extractPage') || 'Extract This Page'}
        </button>
      )}

      {/* Take Screenshot button (visible during recording, no LLM requirement) */}
      {isRecording.value && (
        <button
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            marginBottom: '16px',
            background: 'white',
            color: '#333',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onClick={handleTakeScreenshot}
          title={chrome.i18n.getMessage('takeScreenshotTitle') || 'Add screenshot action to script'}
        >
          <Camera size={16} style={{ color: '#4285f4' }} />
          {chrome.i18n.getMessage('takeScreenshot') || 'Take Screenshot'}
        </button>
      )}

      {/* AI Extraction Suggestions UI */}
      {showExtractionUI.value && (
        <AIExtractionSuggestions
          suggestions={extractionSuggestions.value}
          isLoading={isAnalyzing.value}
          onAccept={handleAcceptSuggestions}
          onCancel={() => {
            showExtractionUI.value = false;
            extractionSuggestions.value = [];
          }}
        />
      )}

      {/* Actions section */}
      <div style={{ background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <span style={{ fontWeight: 500, fontSize: '14px' }}>
            {chrome.i18n.getMessage('capturedActions') || 'Captured Actions'}
          </span>
          <span style={{ fontSize: '12px', background: '#eee', padding: '2px 8px', borderRadius: '12px' }}>
            {recordedActions.value.length.toString()}
          </span>
        </div>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {recordedActions.value.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
              {chrome.i18n.getMessage('noActionsYet') || 'No actions recorded yet'}
            </div>
          ) : (
            <div>
              {recordedActions.value.slice(-20).reverse().map((action, index) => (
                <ActionItem key={`${action.timestamp}-${index}`} action={action} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Password save prompt modal */}
      <PasswordPrompt />
    </div>
  );
}
