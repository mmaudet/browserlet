import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { llmConfigStore, getLLMConfigForServiceWorker, loadLLMConfig, isConfigValid } from '../stores/llmConfig';
import { loadScripts } from '../stores/scripts';
import { navigateTo } from '../router';
import { saveScript } from '../../../utils/storage/scripts';
import { PasswordPrompt, detectedPasswords, showPasswordPrompt } from './PasswordPrompt';
import type { DetectedPassword } from '../../../utils/passwords/types';

// Recording state (synced with storage)
export const isRecording = signal(false);
export const recordedActions = signal<Array<{
  type: string;
  timestamp: number;
  url: string;
  hints: Array<{ type: string; value: unknown }>;
  value?: string;
}>>([]);

// BSL generation state
const isGeneratingBSL = signal(false);
const generationStatus = signal<{ type: 'success' | 'error' | 'info'; message: string; usedLLM?: boolean } | null>(null);

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
function generateBasicBSL(actions: typeof recordedActions.value): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  let scriptName = `Recording ${timestamp}`;

  // Try to extract domain from first navigate action
  const navigateAction = actions.find(a => a.type === 'navigate');
  if (navigateAction) {
    try {
      const url = new URL(navigateAction.url);
      scriptName = `Recording - ${url.hostname}`;
    } catch {
      // Keep default name
    }
  }

  const steps = actions.map(action => {
    const step: Record<string, unknown> = { action: action.type };

    // Add URL for navigate actions
    if (action.type === 'navigate' && action.url) {
      step.url = action.url;
      return step;
    }

    // Add target with top hints
    if (action.hints && action.hints.length > 0) {
      const target: Record<string, unknown> = {};
      // Use top 3 hints for resilience
      action.hints.slice(0, 3).forEach(hint => {
        target[hint.type] = hint.value;
      });
      step.target = target;
    }

    // Add value for input actions
    if (action.value !== undefined) {
      step.value = action.value;
    }

    return step;
  });

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
      const target = step.target as Record<string, unknown>;
      Object.entries(target).forEach(([key, value]) => {
        if (typeof value === 'string') {
          yamlLines.push(`      ${key}: "${value}"`);
        } else {
          yamlLines.push(`      ${key}: ${JSON.stringify(value)}`);
        }
      });
    }
    if (step.value !== undefined) {
      yamlLines.push(`    value: "${step.value}"`);
    }
  });

  return yamlLines.join('\n');
}

/**
 * Generate BSL from recorded actions - tries LLM first, falls back to basic
 */
async function generateBSL(actions: typeof recordedActions.value): Promise<{ bsl: string; usedLLM: boolean }> {
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
    return { bsl: generateBasicBSL(actions), usedLLM: false };
  }

  try {
    // Ensure LLM service is configured with current settings
    const config = getLLMConfigForServiceWorker();
    console.log('[Browserlet] Configuring LLM service with:', { provider: config.provider, hasApiKey: !!config.claudeApiKey });
    await chrome.runtime.sendMessage({ type: 'CONFIGURE_LLM', payload: config });

    // Send GENERATE_BSL message to service worker
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_BSL',
      payload: { actions }
    });

    if (response.success && response.data) {
      return response.data as { bsl: string; usedLLM: boolean };
    } else {
      console.error('GENERATE_BSL failed:', response.error);
      // Fall back to basic generation
      return { bsl: generateBasicBSL(actions), usedLLM: false };
    }
  } catch (error) {
    console.error('Error generating BSL with LLM:', error);
    // Fall back to basic generation
    return { bsl: generateBasicBSL(actions), usedLLM: false };
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
        if (activeTab?.id) {
          const passwordResponse = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_CAPTURED_PASSWORDS' });
          if (passwordResponse.success && passwordResponse.data) {
            capturedPasswords = passwordResponse.data as DetectedPassword[];
            console.log('[Browserlet] Captured passwords:', capturedPasswords.length);
          }
        }
      } catch (error) {
        // Content script might not be available, continue without passwords
        console.warn('[Browserlet] Could not get captured passwords:', error);
      }

      // If passwords were captured, show the password prompt
      if (capturedPasswords.length > 0) {
        detectedPasswords.value = capturedPasswords;
        showPasswordPrompt.value = true;
      }

      if (actions.length === 0) {
        generationStatus.value = {
          type: 'info',
          message: chrome.i18n.getMessage('noActionsYet') || 'No actions to generate script from'
        };
        return;
      }

      // Generate BSL
      isGeneratingBSL.value = true;
      generationStatus.value = {
        type: 'info',
        message: chrome.i18n.getMessage('generatingBSL') || 'Generating script...'
      };

      try {
        const { bsl, usedLLM } = await generateBSL(actions);

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
        if (activeTab?.id) {
          try {
            await chrome.tabs.sendMessage(activeTab.id, { type: 'PING' });
          } catch {
            // Content script not available on this page
            generationStatus.value = {
              type: 'error',
              message: chrome.i18n.getMessage('recordingNotAvailable') ||
                'Recording not available on this page (browser pages, PDFs, or extensions are not supported)'
            };
            return;
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

    // Add CSS for spinner animation if not present
    if (!document.getElementById('recording-view-styles')) {
      const style = document.createElement('style');
      style.id = 'recording-view-styles';
      style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
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

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
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
          marginBottom: '16px',
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
