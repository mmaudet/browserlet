import van from 'vanjs-core';
import { llmConfigStore, getLLMConfigForServiceWorker, loadLLMConfig, isConfigValid } from '../stores/llmConfig';
import { loadScripts } from '../stores/scripts';
import { navigateTo } from '../router';
import { saveScript } from '../../../utils/storage/scripts';

const { div, button, span, p } = van.tags;

// Recording state (synced with storage)
export const isRecording = van.state(false);
export const recordedActions = van.state<Array<{
  type: string;
  timestamp: number;
  url: string;
  hints: Array<{ type: string; value: unknown }>;
  value?: string;
}>>([]);

// BSL generation state
const isGeneratingBSL = van.state(false);
const generationStatus = van.state<{ type: 'success' | 'error' | 'info'; message: string; usedLLM?: boolean } | null>(null);

// Load state from storage
async function loadRecordingState(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    if (response.success && response.data) {
      isRecording.val = response.data.recordingState === 'recording';
      recordedActions.val = response.data.recordedActions || [];
    }
  } catch (error) {
    console.error('Failed to load recording state:', error);
  }
}

// Listen for state changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.appState) {
    const state = changes.appState.newValue as {
      recordingState?: string;
      recordedActions?: typeof recordedActions.val;
    } | undefined;
    isRecording.val = state?.recordingState === 'recording';
    recordedActions.val = state?.recordedActions || [];
  }
});

/**
 * Generate basic BSL locally without LLM (fallback mode)
 */
function generateBasicBSL(actions: typeof recordedActions.val): string {
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
async function generateBSL(actions: typeof recordedActions.val): Promise<{ bsl: string; usedLLM: boolean }> {
  // Reload config from storage to ensure we have latest state
  try {
    await loadLLMConfig();
  } catch (error) {
    console.error('Failed to load LLM config:', error);
  }

  // Check if LLM is configured and valid
  const configured = llmConfigStore.isConfigured.val && isConfigValid();
  console.log('[Browserlet] LLM check - isConfigured:', llmConfigStore.isConfigured.val, 'isValid:', isConfigValid(), 'provider:', llmConfigStore.provider.val);

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
    if (isRecording.val) {
      // Stop recording
      await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });

      // Get final recorded actions
      const stateResponse = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      const actions = stateResponse.success && stateResponse.data?.recordedActions
        ? stateResponse.data.recordedActions
        : recordedActions.val;

      if (actions.length === 0) {
        generationStatus.val = {
          type: 'info',
          message: chrome.i18n.getMessage('noActionsYet') || 'No actions to generate script from'
        };
        return;
      }

      // Generate BSL
      isGeneratingBSL.val = true;
      generationStatus.val = {
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
        generationStatus.val = {
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
        generationStatus.val = {
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to generate script'
        };
      } finally {
        isGeneratingBSL.val = false;
      }
    } else {
      // Start recording - clear previous state
      generationStatus.val = null;
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

function ActionItem({ action }: { action: typeof recordedActions.val[0] }) {
  const hint = action.hints[0];
  const hintText = hint
    ? `${hint.type}: ${typeof hint.value === 'string' ? hint.value : JSON.stringify(hint.value)}`
    : '';
  const valueText = action.value
    ? ` = "${action.value.substring(0, 30)}${action.value.length > 30 ? '...' : ''}"`
    : '';

  return div({
    style: 'padding: 8px; border-bottom: 1px solid #f0f0f0;'
  },
    span({
      style: 'font-weight: 500; color: #333; text-transform: uppercase; font-size: 10px;'
    }, action.type),
    div({
      style: 'margin-top: 4px; font-size: 12px; color: #888; word-break: break-all;'
    }, hintText + valueText)
  );
}

function StatusMessage() {
  return () => {
    const status = generationStatus.val;
    if (!status) return null;

    const styles: Record<string, string> = {
      success: 'background: #d4edda; border: 1px solid #c3e6cb; color: #155724;',
      error: 'background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24;',
      info: 'background: #e7f3ff; border: 1px solid #b6d4fe; color: #084298;'
    };

    return div({
      style: `padding: 10px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 13px; ${styles[status.type]}`
    },
      status.message,
      status.usedLLM !== undefined && div({
        style: 'margin-top: 4px; font-size: 11px; opacity: 0.8;'
      }, status.usedLLM
        ? (chrome.i18n.getMessage('llmConfigured') || 'Using configured LLM provider')
        : (chrome.i18n.getMessage('llmNotConfigured') || 'LLM not configured - using basic generation')
      )
    );
  };
}

function LoadingIndicator() {
  return () => {
    if (!isGeneratingBSL.val) return null;

    return div({
      style: 'display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px; background: #f5f5f5; border-radius: 8px; margin-bottom: 12px;'
    },
      div({
        style: 'width: 16px; height: 16px; border: 2px solid #ddd; border-top-color: #4285f4; border-radius: 50%; animation: spin 1s linear infinite;'
      }),
      span({ style: 'color: #666; font-size: 13px;' },
        chrome.i18n.getMessage('generatingBSL') || 'Generating script...'
      )
    );
  };
}

export function RecordingView() {
  // Load initial state
  loadRecordingState();
  // Load LLM config to check if configured
  loadLLMConfig().catch(console.error);

  // Add CSS for spinner animation if not present
  if (!document.getElementById('recording-view-styles')) {
    const style = document.createElement('style');
    style.id = 'recording-view-styles';
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  return div({ style: 'padding: 16px;' },
    // Recording status
    div({
      style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;'
    },
      span({ style: 'font-weight: 500;' },
        chrome.i18n.getMessage('recording') || 'Recording'
      ),
      span({
        style: () => `font-size: 12px; padding: 4px 8px; border-radius: 4px; ${
          isRecording.val
            ? 'background: #ffebee; color: #c62828;'
            : 'background: #e8f5e9; color: #2e7d32;'
        }`
      }, () => isRecording.val
        ? chrome.i18n.getMessage('recordingActive') || 'Recording...'
        : chrome.i18n.getMessage('idle') || 'Idle'
      )
    ),

    // Loading indicator
    LoadingIndicator(),

    // Status message
    StatusMessage(),

    // LLM status indicator (always visible when not generating)
    () => {
      if (isGeneratingBSL.val || generationStatus.val) {
        return span();
      }

      const configured = llmConfigStore.isConfigured.val && isConfigValid();
      const provider = llmConfigStore.provider.val;
      const needsApiKey = llmConfigStore.needsApiKey.val;

      if (configured) {
        const providerName = provider === 'claude' ? 'Claude (Anthropic)' : 'Ollama';
        return div({
          style: 'display: flex; align-items: center; gap: 8px; background: #e8f5e9; border: 1px solid #c8e6c9; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 12px; color: #2e7d32;'
        },
          span({ style: 'width: 8px; height: 8px; background: #4caf50; border-radius: 50%;' }),
          span({},
            chrome.i18n.getMessage('llmActive') || `LLM active: ${providerName}`
          )
        );
      } else if (needsApiKey) {
        // API key exists but can't be decrypted (session expired)
        return div({
          style: 'display: flex; align-items: center; gap: 8px; background: #fff3cd; border: 1px solid #ffc107; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 12px; color: #856404;'
        },
          span({ style: 'width: 8px; height: 8px; background: #ff9800; border-radius: 50%;' }),
          span({},
            chrome.i18n.getMessage('llmNeedsApiKey') || 'API key expired - please re-enter in Settings'
          )
        );
      } else {
        return div({
          style: 'display: flex; align-items: center; gap: 8px; background: #fff3cd; border: 1px solid #ffc107; padding: 8px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 12px; color: #856404;'
        },
          span({ style: 'width: 8px; height: 8px; background: #ff9800; border-radius: 50%;' }),
          span({},
            chrome.i18n.getMessage('llmNotConfiguredShort') || 'Basic mode (LLM not configured)'
          )
        );
      }
    },

    // Record button
    button({
      style: () => `width: 100%; padding: 12px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; margin-bottom: 16px; ${
        isGeneratingBSL.val
          ? 'background: #ccc; color: #666; cursor: not-allowed;'
          : isRecording.val
            ? 'background: #f44336; color: white;'
            : 'background: #4285f4; color: white;'
      }`,
      disabled: isGeneratingBSL,
      onclick: () => !isGeneratingBSL.val && toggleRecording()
    }, () => isGeneratingBSL.val
      ? chrome.i18n.getMessage('generatingBSL') || 'Generating...'
      : isRecording.val
        ? chrome.i18n.getMessage('stopRecording') || 'Stop Recording'
        : chrome.i18n.getMessage('startRecording') || 'Start Recording'
    ),

    // Actions section
    div({
      style: 'background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);'
    },
      div({
        style: 'display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #f0f0f0;'
      },
        span({ style: 'font-weight: 500; font-size: 14px;' },
          chrome.i18n.getMessage('capturedActions') || 'Captured Actions'
        ),
        span({
          style: 'font-size: 12px; background: #eee; padding: 2px 8px; border-radius: 12px;'
        }, () => recordedActions.val.length.toString())
      ),
      div({ style: 'max-height: 300px; overflow-y: auto;' },
        () => {
          const actions = recordedActions.val;
          if (actions.length === 0) {
            return div({
              style: 'padding: 24px; text-align: center; color: #999; font-size: 13px;'
            }, chrome.i18n.getMessage('noActionsYet') || 'No actions recorded yet');
          }
          return div(
            ...actions.slice(-20).reverse().map(action => ActionItem({ action }))
          );
        }
      )
    )
  );
}
