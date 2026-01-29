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

const { div, label, input, select, option, button, span, p, h3 } = van.tags;

/** Claude model options */
const CLAUDE_MODELS = [
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (balanced)' },
  { value: 'claude-haiku-4-5-20250929', label: 'Claude Haiku 4.5 (faster, cheaper)' },
  { value: 'claude-opus-4-5-20250929', label: 'Claude Opus 4.5 (most capable)' },
];

/**
 * LLM Settings component
 * Provides UI for configuring LLM provider and credentials
 */
export function LLMSettings() {
  // Local state for feedback
  const saveSuccess = van.state(false);
  const testingConnection = van.state(false);
  const connectionStatus = van.state<string | null>(null);

  // Initialize on mount
  loadLLMConfig().catch(console.error);

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
      const host = llmConfigStore.ollamaHost.val;
      const response = await fetch(`${host}/api/tags`, { method: 'GET' });
      if (response.ok) {
        const data = await response.json();
        const models = data.models?.length ?? 0;
        connectionStatus.val = `Connected! ${models} model(s) available.`;
      } else {
        connectionStatus.val = `Connection failed: ${response.status}`;
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
  const btnSecondaryStyle = 'padding: 8px 16px; background-color: #e0e0e0; color: #333; border: none; border-radius: 6px; cursor: pointer; font-size: 13px;';
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
        value: () => llmConfigStore.provider.val,
        onchange: handleProviderChange,
      },
        option({ value: 'claude' }, 'Claude API (Anthropic)'),
        option({ value: 'ollama' }, 'Ollama (Local)')
      )
    ),

    // Claude-specific settings
    () => llmConfigStore.provider.val === 'claude' ? div(
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
          value: () => llmConfigStore.claudeModel.val,
          onchange: handleClaudeModelChange,
        },
          ...CLAUDE_MODELS.map(m => option({ value: m.value }, m.label))
        )
      )
    ) : null,

    // Ollama-specific settings
    () => llmConfigStore.provider.val === 'ollama' ? div(
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

      // Model input
      div({ style: sectionStyle },
        label({ style: labelStyle },
          chrome.i18n.getMessage('ollamaModel') || 'Model Name'
        ),
        input({
          type: 'text',
          style: inputStyle,
          placeholder: 'llama3.1',
          value: () => llmConfigStore.ollamaModel.val,
          oninput: handleOllamaModelChange,
        })
      ),

      // Test connection button
      div({ style: 'margin-bottom: 16px;' },
        button({
          style: () => testingConnection.val ? btnSecondaryStyle + btnDisabledStyle : btnSecondaryStyle,
          disabled: testingConnection,
          onclick: testOllamaConnection,
        },
          () => testingConnection.val
            ? (chrome.i18n.getMessage('testing') || 'Testing...')
            : (chrome.i18n.getMessage('testConnection') || 'Test Connection')
        ),
        () => connectionStatus.val ? span({
          style: `margin-left: 12px; font-size: 13px; color: ${connectionStatus.val.startsWith('Connected') ? '#28a745' : '#dc3545'};`
        }, connectionStatus.val) : null
      )
    ) : null,

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
          span({ style: 'font-weight: 500;' }, 'Status: '),
          () => llmConfigStore.isConfigured.val
            ? span({ style: 'color: #28a745;' }, 'Configured')
            : span({ style: 'color: #dc3545;' }, 'Not configured')
        ),
        div(
          span({ style: 'font-weight: 500;' }, 'Provider: '),
          () => llmConfigStore.provider.val === 'claude' ? 'Claude API' : 'Ollama'
        )
      )
    ),

    // Info note for Claude
    () => llmConfigStore.provider.val === 'claude' ? div({ style: infoStyle },
      p({ style: 'margin: 0;' },
        chrome.i18n.getMessage('sessionKeyNote') ||
        'Note: Your API key is encrypted and stored locally. After browser restart, you will need to re-enter your API key for security.'
      )
    ) : null
  );
}
