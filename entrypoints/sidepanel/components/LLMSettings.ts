/**
 * LLM Settings UI Component
 * Allows configuring LLM provider, API keys, and model selection
 */

import van from 'vanjs-core';
import {
  llmConfigStore,
  saveLLMConfig,
  loadLLMConfig,
  isConfigValid,
} from '../stores/llmConfig';
import type { ProviderName } from '../../background/llm/providers/types';
import { resetAllExtensionData } from '../../../utils/storage/reset';

const { div, label, input, select, option, button, span, p, h3 } = van.tags;

/** Claude model options */
const CLAUDE_MODELS = [
  { value: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.5 (balanced)' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (faster, cheaper)' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (previous gen)' },
];

/**
 * LLM Settings component
 * Provides UI for configuring LLM provider and credentials
 */
export function LLMSettings() {
  // Local state for feedback
  const saveSuccess = van.state(false);
  const resetSuccess = van.state(false);
  const testingConnection = van.state(false);
  const connectionStatus = van.state<string | null>(null);
  const ollamaModels = van.state<string[]>([]);
  const loadingModels = van.state(false);

  // Initialize on mount
  loadLLMConfig().catch(console.error);

  // Fetch Ollama models from the API
  const fetchOllamaModels = async () => {
    loadingModels.val = true;
    try {
      const host = llmConfigStore.ollamaHost.val;
      const response = await fetch(`${host}/api/tags`, { method: 'GET' });
      if (response.ok) {
        const data = await response.json();
        const models = (data.models || []).map((m: { name: string }) => m.name);
        ollamaModels.val = models;
        return models;
      }
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
    } finally {
      loadingModels.val = false;
    }
    return [];
  };

  const handleSave = async () => {
    saveSuccess.val = false;
    try {
      await saveLLMConfig();
      saveSuccess.val = true;
      setTimeout(() => { saveSuccess.val = false; }, 3000);
    } catch (error) {
      console.error('Failed to save LLM config:', error);
    }
  };

  const handleProviderChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    llmConfigStore.provider.val = target.value as ProviderName;
    // Clear API key when switching away from Claude
    if (target.value === 'ollama') {
      llmConfigStore.claudeApiKey.val = '';
    }
  };

  const handleApiKeyChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    llmConfigStore.claudeApiKey.val = target.value;
  };

  const handleClaudeModelChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    llmConfigStore.claudeModel.val = target.value;
  };

  const handleOllamaHostChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    llmConfigStore.ollamaHost.val = target.value;
  };

  const handleOllamaModelChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    llmConfigStore.ollamaModel.val = target.value;
  };

  const testOllamaConnection = async () => {
    testingConnection.val = true;
    connectionStatus.val = null;
    try {
      const models = await fetchOllamaModels();
      if (models.length > 0) {
        connectionStatus.val = `Connected! ${models.length} model(s) available.`;
        // Auto-select first model if none selected
        if (!llmConfigStore.ollamaModel.val || !models.includes(llmConfigStore.ollamaModel.val)) {
          llmConfigStore.ollamaModel.val = models[0];
        }
      } else {
        connectionStatus.val = 'Connected but no models found. Run: ollama pull llama3.1';
      }
    } catch (error) {
      connectionStatus.val = 'Connection failed: Cannot reach Ollama server';
    } finally {
      testingConnection.val = false;
    }
  };

  // Styles
  const containerStyle = 'padding: 16px;';
  const sectionStyle = 'margin-bottom: 20px;';
  const labelStyle = 'display: block; font-weight: 500; margin-bottom: 6px; color: #333; font-size: 13px;';
  const inputStyle = 'width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;';
  const selectStyle = inputStyle;
  const btnPrimaryStyle = 'width: 100%; padding: 10px; background-color: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;';
  const btnPrimarySmallStyle = 'padding: 8px 16px; background-color: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;';
  const btnSecondaryStyle = 'padding: 8px 16px; background-color: #e0e0e0; color: #333; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;';
  const btnDangerStyle = 'padding: 8px 16px; background-color: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;';
  const btnDisabledStyle = 'opacity: 0.6; cursor: not-allowed;';
  const warningStyle = 'background-color: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 6px; margin-bottom: 16px;';
  const successStyle = 'background-color: #d4edda; border: 1px solid #28a745; padding: 12px; border-radius: 6px; margin-bottom: 16px; color: #155724;';
  const errorStyle = 'background-color: #f8d7da; border: 1px solid #dc3545; padding: 12px; border-radius: 6px; margin-bottom: 16px; color: #721c24;';
  const infoStyle = 'background-color: #e7f3ff; border: 1px solid #0066cc; padding: 12px; border-radius: 6px; margin-top: 16px; font-size: 12px; color: #004085;';

  return div({ style: containerStyle },
    // Header
    h3({ style: 'margin: 0 0 16px 0; font-size: 16px; font-weight: 600;' },
      chrome.i18n.getMessage('llmSettingsTitle') || 'LLM Settings'
    ),

    // API key warning (show if needsApiKey is true)
    () => llmConfigStore.needsApiKey.val ? div({ style: warningStyle },
      p({ style: 'margin: 0 0 4px 0; font-weight: 500;' },
        chrome.i18n.getMessage('apiKeyRequired') || 'API Key Required'
      ),
      p({ style: 'margin: 0; font-size: 13px;' },
        chrome.i18n.getMessage('apiKeyExpired') || 'Your API key needs to be re-entered after browser restart.'
      )
    ) : null,

    // Save success message
    () => saveSuccess.val ? div({ style: successStyle },
      chrome.i18n.getMessage('settingsSaved') || 'Settings saved successfully!'
    ) : null,

    // Save error message
    () => llmConfigStore.saveError.val ? div({ style: errorStyle },
      llmConfigStore.saveError.val
    ) : null,

    // Provider selection
    div({ style: sectionStyle },
      label({ style: labelStyle },
        chrome.i18n.getMessage('llmProvider') || 'LLM Provider'
      ),
      select({
        style: selectStyle,
        onchange: handleProviderChange,
      },
        option({
          value: 'claude',
          selected: () => llmConfigStore.provider.val === 'claude'
        }, 'Claude API (Anthropic)'),
        option({
          value: 'ollama',
          selected: () => llmConfigStore.provider.val === 'ollama'
        }, 'Ollama (Local)')
      )
    ),

    // Claude-specific settings
    div(
      { style: () => llmConfigStore.provider.val === 'claude' ? '' : 'display: none;' },
      // API Key input
      div({ style: sectionStyle },
        label({ style: labelStyle },
          chrome.i18n.getMessage('apiKey') || 'API Key'
        ),
        input({
          type: 'password',
          style: inputStyle,
          placeholder: 'sk-ant-...',
          value: () => llmConfigStore.claudeApiKey.val,
          oninput: handleApiKeyChange,
        }),
        p({ style: 'margin: 6px 0 0 0; font-size: 11px; color: #666;' },
          chrome.i18n.getMessage('apiKeyHint') || 'Get your API key from console.anthropic.com'
        )
      ),

      // Claude model selection
      div({ style: sectionStyle },
        label({ style: labelStyle },
          chrome.i18n.getMessage('llmModel') || 'Model'
        ),
        select({
          style: selectStyle,
          onchange: handleClaudeModelChange,
        },
          ...CLAUDE_MODELS.map(m => option({
            value: m.value,
            selected: () => llmConfigStore.claudeModel.val === m.value
          }, m.label))
        )
      )
    ),

    // Ollama-specific settings
    div(
      { style: () => llmConfigStore.provider.val === 'ollama' ? '' : 'display: none;' },
      // Host input
      div({ style: sectionStyle },
        label({ style: labelStyle },
          chrome.i18n.getMessage('ollamaHost') || 'Ollama Host'
        ),
        input({
          type: 'text',
          style: inputStyle,
          placeholder: 'http://localhost:11434',
          value: () => llmConfigStore.ollamaHost.val,
          oninput: handleOllamaHostChange,
        })
      ),

      // Test connection button (before model selection)
      div({ style: 'margin-bottom: 16px;' },
        button({
          style: () => testingConnection.val ? btnPrimarySmallStyle + btnDisabledStyle : btnPrimarySmallStyle,
          disabled: () => testingConnection.val,
          onclick: testOllamaConnection,
        },
          () => testingConnection.val
            ? (chrome.i18n.getMessage('testing') || 'Testing...')
            : (chrome.i18n.getMessage('testConnection') || 'Test Connection')
        ),
        () => connectionStatus.val ? span({
          style: `margin-left: 12px; font-size: 13px; color: ${connectionStatus.val.startsWith('Connected') ? '#28a745' : '#dc3545'};`
        }, connectionStatus.val) : span()
      ),

      // Model selection (populated after connection test)
      div({ style: sectionStyle },
        label({ style: labelStyle },
          chrome.i18n.getMessage('ollamaModel') || 'Model'
        ),
        () => ollamaModels.val.length > 0
          ? select({
              style: selectStyle,
              onchange: (e: Event) => {
                llmConfigStore.ollamaModel.val = (e.target as HTMLSelectElement).value;
              },
            },
              ...ollamaModels.val.map(model => option({
                value: model,
                selected: () => llmConfigStore.ollamaModel.val === model
              }, model))
            )
          : div(
              input({
                type: 'text',
                style: inputStyle,
                placeholder: 'llama3.1',
                value: () => llmConfigStore.ollamaModel.val,
                oninput: handleOllamaModelChange,
              }),
              p({ style: 'margin: 6px 0 0 0; font-size: 11px; color: #666;' },
                chrome.i18n.getMessage('loadModelsHint') || 'Click "Test Connection" to load available models'
              )
            )
      )
    ),

    // Save button
    div({ style: sectionStyle },
      button({
        style: () => {
          const disabled = llmConfigStore.isSaving.val || !isConfigValid();
          return disabled ? btnPrimaryStyle + btnDisabledStyle : btnPrimaryStyle;
        },
        disabled: () => llmConfigStore.isSaving.val || !isConfigValid(),
        onclick: handleSave,
      },
        () => llmConfigStore.isSaving.val
          ? (chrome.i18n.getMessage('saving') || 'Saving...')
          : (chrome.i18n.getMessage('saveSettings') || 'Save Settings')
      )
    ),

    // Status section
    div({ style: 'margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee;' },
      div({ style: 'font-size: 13px; color: #666;' },
        div({ style: 'margin-bottom: 8px;' },
          span({ style: 'font-weight: 500;' }, (chrome.i18n.getMessage('statusLabel') || 'Status') + ': '),
          () => {
            // Show configured only if saved AND current form is valid
            const saved = llmConfigStore.isConfigured.val;
            const valid = isConfigValid();
            if (saved && valid) {
              return span({ style: 'color: #28a745;' }, chrome.i18n.getMessage('statusConfigured') || 'Configured');
            }
            return span({ style: 'color: #dc3545;' }, chrome.i18n.getMessage('statusNotConfigured') || 'Not configured');
          }
        ),
        div(
          span({ style: 'font-weight: 500;' }, (chrome.i18n.getMessage('providerLabel') || 'Provider') + ': '),
          () => llmConfigStore.provider.val === 'claude' ? 'Claude API' : 'Ollama'
        )
      )
    ),

    // Info note for Claude
    div(
      { style: () => llmConfigStore.provider.val === 'claude' ? infoStyle : 'display: none;' },
      p({ style: 'margin: 0;' },
        chrome.i18n.getMessage('sessionKeyNote') ||
        'Note: Your API key is encrypted and stored locally. After browser restart, you will need to re-enter your API key for security.'
      )
    ),

    // Reset section
    div({ style: 'margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee;' },
      h3({ style: 'margin: 0 0 8px 0; font-size: 14px; color: #d32f2f;' },
        chrome.i18n.getMessage('dangerZone') || 'Danger Zone'
      ),
      p({ style: 'margin: 0 0 12px 0; font-size: 12px; color: #666;' },
        chrome.i18n.getMessage('resetWarning') || 'This will permanently delete ALL extension data: scripts, settings, triggers, and history.'
      ),
      () => resetSuccess.val ? div({ style: successStyle },
        chrome.i18n.getMessage('resetSuccess') || 'All data has been reset. Reloading...'
      ) : null,
      button({
        style: btnDangerStyle,
        onclick: async () => {
          const confirmMsg = chrome.i18n.getMessage('resetConfirmFull') ||
            'WARNING: This will delete ALL your data:\n\n' +
            '- All saved scripts\n' +
            '- LLM configuration\n' +
            '- Trigger settings\n' +
            '- Execution history\n' +
            '- Recorded actions\n\n' +
            'This cannot be undone. Continue?';
          if (confirm(confirmMsg)) {
            await resetAllExtensionData();
            ollamaModels.val = [];
            connectionStatus.val = null;
            resetSuccess.val = true;
            // Reload the sidepanel after a short delay to refresh all state
            setTimeout(() => { window.location.reload(); }, 1500);
          }
        },
      },
        chrome.i18n.getMessage('resetAllData') || 'Reset All Data'
      )
    )
  );
}
