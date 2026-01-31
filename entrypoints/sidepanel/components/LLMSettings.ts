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

/** Anthropic API base URL */
const ANTHROPIC_API_BASE = 'https://api.anthropic.com';

/** Helper to format label with colon (French requires space before colon) */
const formatLabelWithColon = (label: string): string => {
  const isFrench = chrome.i18n.getUILanguage().startsWith('fr');
  return isFrench ? `${label} :` : `${label}:`;
};

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

  // OpenAI models state
  const openaiModels = van.state<string[]>([]);
  const openaiModelsLoading = van.state(false);
  const openaiModelsStatus = van.state<string | null>(null);
  const openaiModelSearch = van.state<string>('');

  // Claude/Anthropic models state
  const claudeModels = van.state<string[]>([]);
  const claudeModelsLoading = van.state(false);
  const claudeModelsStatus = van.state<string | null>(null);
  const claudeModelSearch = van.state<string>('');

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
    const saveButton = document.getElementById('llm-save-button') as HTMLButtonElement | null;

    // Disable button during save
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.style.cssText = btnPrimaryStyle + btnDisabledStyle;
      saveButton.textContent = chrome.i18n.getMessage('saving') || 'Saving...';
    }

    try {
      // Read provider directly from the select element (most reliable source)
      const providerSelect = document.getElementById('llm-provider-select') as HTMLSelectElement | null;
      const actualProvider = (providerSelect?.value || 'claude') as ProviderName;
      await saveLLMConfig(actualProvider);
      saveSuccess.val = true;
      setTimeout(() => { saveSuccess.val = false; }, 3000);

      // Update status display after successful save
      const statusDisplay = document.getElementById('llm-status-display');
      if (statusDisplay) {
        statusDisplay.textContent = chrome.i18n.getMessage('statusConfigured') || 'Configured';
        statusDisplay.style.color = '#28a745';
      }

      const providerDisplay = document.getElementById('llm-provider-display');
      if (providerDisplay) {
        // Get the selected model based on provider
        let modelName = '';
        if (actualProvider === 'openai') {
          modelName = llmConfigStore.openaiModel.val;
        } else if (actualProvider === 'claude') {
          modelName = llmConfigStore.claudeModel.val;
        } else if (actualProvider === 'ollama') {
          modelName = llmConfigStore.ollamaModel.val;
        }

        const providerName = actualProvider === 'openai' ? 'OpenAI Compatible' :
                            actualProvider === 'claude' ? 'Anthropic (Claude)' : 'Ollama';
        const displayName = modelName ? `${providerName} (${modelName})` : providerName;
        providerDisplay.textContent = displayName;
      }
    } catch (error) {
      console.error('Failed to save LLM config:', error);
    } finally {
      // Re-enable button after save
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.style.cssText = btnPrimaryStyle;
        saveButton.textContent = chrome.i18n.getMessage('saveSettings') || 'Save Settings';
      }
    }
  };

  const handleProviderChange = (e: Event) => {
    const target = e.target as HTMLSelectElement;
    llmConfigStore.provider.val = target.value as ProviderName;
    // Clear model lists when switching providers
    openaiModels.val = [];
    openaiModelsStatus.val = null;
    openaiModelSearch.val = '';
    claudeModels.val = [];
    claudeModelsStatus.val = null;
    claudeModelSearch.val = '';
    ollamaModels.val = [];
    connectionStatus.val = null;
  };

  const handleOpenaiEndpointChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    llmConfigStore.openaiEndpoint.val = target.value;
  };

  const handleOpenaiApiKeyChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    llmConfigStore.openaiApiKey.val = target.value;
  };

  const handleOpenaiModelChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    llmConfigStore.openaiModel.val = target.value;
  };

  // Derive models endpoint from chat completions endpoint
  const getModelsEndpoint = (chatEndpoint: string): string => {
    // Replace /chat/completions with /models
    return chatEndpoint.replace(/\/chat\/completions\/?$/, '/models');
  };

  // Fetch OpenAI-compatible models from the API
  const fetchOpenaiModels = async () => {
    const endpoint = llmConfigStore.openaiEndpoint.val;
    const apiKey = llmConfigStore.openaiApiKey.val;

    if (!endpoint || !apiKey) {
      openaiModelsStatus.val = 'Please enter endpoint and API key first';
      return;
    }

    openaiModelsLoading.val = true;
    openaiModelsStatus.val = null;
    openaiModelSearch.val = '';

    try {
      const modelsEndpoint = getModelsEndpoint(endpoint);

      const response = await fetch(modelsEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText.substring(0, 100)}`);
      }

      const data = await response.json();
      // OpenAI API returns { data: [{ id: "model-name", ... }] }
      const models = (data.data || [])
        .map((m: { id: string }) => m.id)
        .sort((a: string, b: string) => a.localeCompare(b));

      if (models.length === 0) {
        openaiModelsStatus.val = 'Connected but no models found';
        openaiModels.val = [];
        return;
      }

      openaiModels.val = models;
      openaiModelsStatus.val = `${models.length} model(s) available`;

      // Auto-select first model if current model is not in the list
      if (!llmConfigStore.openaiModel.val || !models.includes(llmConfigStore.openaiModel.val)) {
        // Try to find a good default (gpt-4o, gpt-4, etc.)
        const preferredModels = ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
        const defaultModel = preferredModels.find(m => models.includes(m)) || models[0];
        llmConfigStore.openaiModel.val = defaultModel;
      }

      // Directly show save button (we know we're in OpenAI mode and have models)
      const saveSection = document.getElementById('llm-save-section');
      if (saveSection) {
        saveSection.style.setProperty('display', 'block', 'important');
      }
    } catch (error) {
      console.error('[LLM Settings] Failed to fetch OpenAI models:', error);
      openaiModelsStatus.val = error instanceof Error ? error.message : 'Connection failed';
      openaiModels.val = [];
    } finally {
      openaiModelsLoading.val = false;
    }
  };

  // Filter models based on search
  const getFilteredOpenaiModels = (): string[] => {
    const search = openaiModelSearch.val.toLowerCase();
    if (!search) return openaiModels.val;
    return openaiModels.val.filter(m => m.toLowerCase().includes(search));
  };

  // Fetch Claude/Anthropic models from the API
  const fetchClaudeModels = async () => {
    const apiKey = llmConfigStore.claudeApiKey.val;

    if (!apiKey) {
      claudeModelsStatus.val = 'Please enter API key first';
      return;
    }

    claudeModelsLoading.val = true;
    claudeModelsStatus.val = null;
    claudeModelSearch.val = '';

    try {

      const response = await fetch(`${ANTHROPIC_API_BASE}/v1/models`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText.substring(0, 100)}`);
      }

      const data = await response.json();
      // Anthropic API returns { data: [{ id: "model-name", ... }] }
      const models = (data.data || [])
        .map((m: { id: string }) => m.id)
        .sort((a: string, b: string) => a.localeCompare(b));

      if (models.length === 0) {
        claudeModelsStatus.val = 'Connected but no models found';
        claudeModels.val = [];
        return;
      }

      claudeModels.val = models;
      claudeModelsStatus.val = `${models.length} model(s) available`;

      // Auto-select a good default if current model is not in the list
      if (!llmConfigStore.claudeModel.val || !models.includes(llmConfigStore.claudeModel.val)) {
        // Try to find a good default (claude-sonnet-4, claude-3-5-sonnet, etc.)
        const preferredModels = ['claude-sonnet-4-5-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'];
        const defaultModel = preferredModels.find(m => models.includes(m)) || models[0];
        llmConfigStore.claudeModel.val = defaultModel;
      }

      // Directly show save button (we know we're in Claude mode and have models)
      const saveSection = document.getElementById('llm-save-section');
      if (saveSection) {
        saveSection.style.setProperty('display', 'block', 'important');
      }
    } catch (error) {
      console.error('[LLM Settings] Failed to fetch Claude models:', error);
      claudeModelsStatus.val = error instanceof Error ? error.message : 'Connection failed';
      claudeModels.val = [];
    } finally {
      claudeModelsLoading.val = false;
    }
  };

  // Filter Claude models based on search
  const getFilteredClaudeModels = (): string[] => {
    const search = claudeModelSearch.val.toLowerCase();
    if (!search) return claudeModels.val;
    return claudeModels.val.filter(m => m.toLowerCase().includes(search));
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
        // Directly show save button (we know we're in Ollama mode and have models)
        const saveSection = document.getElementById('llm-save-section');
        if (saveSection) {
          saveSection.style.setProperty('display', 'block', 'important');
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

  // Track current provider locally (VanJS cross-module state is unreliable)
  let currentProvider: ProviderName = llmConfigStore.provider.val;

  // Local validation function using currentProvider instead of store
  const isCurrentConfigValid = (): boolean => {
    if (currentProvider === 'claude') {
      return !!llmConfigStore.claudeApiKey.val;
    }
    if (currentProvider === 'openai') {
      return !!llmConfigStore.openaiApiKey.val && !!llmConfigStore.openaiEndpoint.val;
    }
    return true; // Ollama doesn't require credentials
  };

  // Update save button visibility based on current state
  const updateSaveButtonVisibility = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const saveSection = document.getElementById('llm-save-section');
        if (!saveSection) return;

        let shouldShow = false;
        if (currentProvider === 'claude' && claudeModels.val.length > 0) {
          shouldShow = true;
        } else if (currentProvider === 'openai' && openaiModels.val.length > 0) {
          shouldShow = true;
        } else if (currentProvider === 'ollama' && llmConfigStore.ollamaHost.val) {
          shouldShow = true;
        }

        saveSection.style.setProperty('display', shouldShow ? 'block' : 'none', 'important');
      });
    });
  };

  // Update section visibility and other UI elements by ID (delayed to run after VanJS updates)
  const updateSectionVisibility = (provider: ProviderName) => {
    // Use double requestAnimationFrame to ensure we run after VanJS DOM updates
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {

        // Update sections visibility
        const claudeSection = document.getElementById('llm-claude-section');
        const openaiSection = document.getElementById('llm-openai-section');
        const ollamaSection = document.getElementById('llm-ollama-section');
        if (claudeSection) {
          claudeSection.style.setProperty('display', provider === 'claude' ? 'block' : 'none', 'important');
        }
        if (openaiSection) {
          openaiSection.style.setProperty('display', provider === 'openai' ? 'block' : 'none', 'important');
        }
        if (ollamaSection) {
          ollamaSection.style.setProperty('display', provider === 'ollama' ? 'block' : 'none', 'important');
        }

        // Update the select dropdown value
        const providerSelect = document.getElementById('llm-provider-select') as HTMLSelectElement | null;
        if (providerSelect) {
          providerSelect.value = provider;
        }

        // Update the status display
        const providerDisplay = document.getElementById('llm-provider-display');
        if (providerDisplay) {
          const displayName = provider === 'openai' ? 'OpenAI Compatible' :
                             provider === 'claude' ? 'Anthropic (Claude)' : 'Ollama';
          providerDisplay.textContent = displayName;
        }

        // Also update save button visibility
        updateSaveButtonVisibility();
      });
    });
  };

  // Provider change handler
  const onProviderChange = (e: Event) => {
    const newValue = (e.target as HTMLSelectElement).value as ProviderName;
    currentProvider = newValue;  // Update local tracker
    llmConfigStore.provider.val = newValue;
    // Clear model lists when switching providers
    openaiModels.val = [];
    openaiModelsStatus.val = null;
    openaiModelSearch.val = '';
    claudeModels.val = [];
    claudeModelsStatus.val = null;
    claudeModelSearch.val = '';
    ollamaModels.val = [];
    connectionStatus.val = null;
    // Manually update section visibility
    updateSectionVisibility(newValue);
  };
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
        id: 'llm-provider-select',
        style: selectStyle,
        onchange: onProviderChange,
      },
        option({ value: 'openai', selected: llmConfigStore.provider.val === 'openai' }, 'OpenAI Compatible'),
        option({ value: 'claude', selected: llmConfigStore.provider.val === 'claude' }, 'Anthropic (Claude)'),
        option({ value: 'ollama', selected: llmConfigStore.provider.val === 'ollama' }, 'Ollama (Local)')
      )
    ),

    // Claude/Anthropic-specific settings
    div(
      {
        id: 'llm-claude-section',
        style: llmConfigStore.provider.val === 'claude' ? 'display: block;' : 'display: none;'
      },
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

      // Fetch models button (show when API key is entered)
      div({
        style: () => llmConfigStore.claudeApiKey.val ? 'margin-bottom: 16px;' : 'display: none;'
      },
        button({
          style: () => claudeModelsLoading.val ? btnPrimarySmallStyle + btnDisabledStyle : btnPrimarySmallStyle,
          disabled: () => claudeModelsLoading.val,
          onclick: fetchClaudeModels,
        },
          () => claudeModelsLoading.val
            ? (chrome.i18n.getMessage('loadingModels') || 'Loading models...')
            : (chrome.i18n.getMessage('fetchModels') || 'Fetch Available Models')
        ),
        () => claudeModelsStatus.val ? span({
          style: `margin-left: 12px; font-size: 13px; color: ${claudeModelsStatus.val.includes('available') ? '#28a745' : '#dc3545'};`
        }, claudeModelsStatus.val) : span()
      ),

      // Claude model selection (show only when models have been fetched)
      div({
        style: () => claudeModels.val.length > 0 ? sectionStyle : 'display: none;'
      },
        label({ style: labelStyle },
          chrome.i18n.getMessage('llmModel') || 'Model'
        ),
        // Search input (static, not recreated when search changes)
        input({
          type: 'text',
          style: inputStyle + ' margin-bottom: 8px;',
          placeholder: chrome.i18n.getMessage('searchModels') || 'Search models...',
          oninput: (e: Event) => {
            claudeModelSearch.val = (e.target as HTMLInputElement).value;
          },
        }),
        // Model select dropdown - reactive based on search
        () => {
          const filtered = getFilteredClaudeModels();
          return div(
            select({
              style: selectStyle,
              onchange: (e: Event) => {
                llmConfigStore.claudeModel.val = (e.target as HTMLSelectElement).value;
              },
            },
              ...(filtered.length === 0
                ? [option({ value: '', disabled: true }, 'No models match search')]
                : filtered.map(model => option({
                    value: model,
                    selected: llmConfigStore.claudeModel.val === model
                  }, model))
              )
            ),
            p({ style: 'margin: 6px 0 0 0; font-size: 11px; color: #666;' },
              `${filtered.length} of ${claudeModels.val.length} models shown`
            )
          );
        }
      )
    ),

    // Ollama-specific settings
    div(
      {
        id: 'llm-ollama-section',
        style: llmConfigStore.provider.val === 'ollama' ? 'display: block;' : 'display: none;'
      },
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

    // OpenAI-compatible settings
    div(
      {
        id: 'llm-openai-section',
        style: llmConfigStore.provider.val === 'openai' ? 'display: block;' : 'display: none;'
      },
      // Endpoint input
      div({ style: sectionStyle },
        label({ style: labelStyle },
          chrome.i18n.getMessage('openaiEndpoint') || 'API Endpoint'
        ),
        input({
          type: 'text',
          style: inputStyle,
          placeholder: 'https://api.openai.com/v1/chat/completions',
          value: () => llmConfigStore.openaiEndpoint.val,
          oninput: handleOpenaiEndpointChange,
        }),
        p({ style: 'margin: 6px 0 0 0; font-size: 11px; color: #666;' },
          chrome.i18n.getMessage('openaiEndpointHint') || 'Chat completions endpoint (OpenAI, Azure, OpenRouter, etc.)'
        )
      ),

      // API Key input
      div({ style: sectionStyle },
        label({ style: labelStyle },
          chrome.i18n.getMessage('apiKey') || 'API Key'
        ),
        input({
          type: 'password',
          style: inputStyle,
          placeholder: 'sk-...',
          value: () => llmConfigStore.openaiApiKey.val,
          oninput: handleOpenaiApiKeyChange,
        })
      ),

      // Fetch models button (show when endpoint and API key are entered)
      div({
        style: () => (llmConfigStore.openaiEndpoint.val && llmConfigStore.openaiApiKey.val) ? 'margin-bottom: 16px;' : 'display: none;'
      },
        button({
          style: () => openaiModelsLoading.val ? btnPrimarySmallStyle + btnDisabledStyle : btnPrimarySmallStyle,
          disabled: () => openaiModelsLoading.val,
          onclick: fetchOpenaiModels,
        },
          () => openaiModelsLoading.val
            ? (chrome.i18n.getMessage('loadingModels') || 'Loading models...')
            : (chrome.i18n.getMessage('fetchModels') || 'Fetch Available Models')
        ),
        () => openaiModelsStatus.val ? span({
          style: `margin-left: 12px; font-size: 13px; color: ${openaiModelsStatus.val.includes('available') ? '#28a745' : '#dc3545'};`
        }, openaiModelsStatus.val) : span()
      ),

      // Model selection (show only when models have been fetched)
      div({
        style: () => openaiModels.val.length > 0 ? sectionStyle : 'display: none;'
      },
        label({ style: labelStyle },
          chrome.i18n.getMessage('openaiModel') || 'Model'
        ),
        // Search input (static, not recreated when search changes)
        input({
          type: 'text',
          style: inputStyle + ' margin-bottom: 8px;',
          placeholder: chrome.i18n.getMessage('searchModels') || 'Search models...',
          oninput: (e: Event) => {
            openaiModelSearch.val = (e.target as HTMLInputElement).value;
          },
        }),
        // Model select dropdown - reactive based on search
        () => {
          const filtered = getFilteredOpenaiModels();
          return div(
            select({
              style: selectStyle,
              onchange: (e: Event) => {
                llmConfigStore.openaiModel.val = (e.target as HTMLSelectElement).value;
              },
            },
              ...(filtered.length === 0
                ? [option({ value: '', disabled: true }, 'No models match search')]
                : filtered.map(model => option({
                    value: model,
                    selected: llmConfigStore.openaiModel.val === model
                  }, model))
                )
            ),
            p({ style: 'margin: 6px 0 0 0; font-size: 11px; color: #666;' },
              `${filtered.length} of ${openaiModels.val.length} models shown`
            )
          );
        }
      )
    ),

    // Save button (only show when configuration is complete)
    // Visibility and enabled state managed manually - not reactive
    div({
      id: 'llm-save-section',
      style: 'display: none;',  // Hidden by default, shown when models are fetched
    },
      button({
        id: 'llm-save-button',
        style: btnPrimaryStyle,  // Not reactive - managed manually
        onclick: handleSave,
      },
        chrome.i18n.getMessage('saveSettings') || 'Save Settings'
      )
    ),

    // Status section - managed manually, not reactive
    div({ style: 'margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee;' },
      div({ style: 'font-size: 13px; color: #666;' },
        div({ style: 'margin-bottom: 8px;' },
          span({ style: 'font-weight: 500;' }, formatLabelWithColon(chrome.i18n.getMessage('statusLabel') || 'Status') + ' '),
          span({
            id: 'llm-status-display',
            style: llmConfigStore.isConfigured.val ? 'color: #28a745;' : 'color: #dc3545;'
          }, llmConfigStore.isConfigured.val
            ? (chrome.i18n.getMessage('statusConfigured') || 'Configured')
            : (chrome.i18n.getMessage('statusNotConfigured') || 'Not configured'))
        ),
        div(
          span({ style: 'font-weight: 500;' }, formatLabelWithColon(chrome.i18n.getMessage('providerLabel') || 'Provider') + ' '),
          span({
            id: 'llm-provider-display'
          }, llmConfigStore.provider.val === 'openai' ? 'OpenAI Compatible' :
             llmConfigStore.provider.val === 'claude' ? 'Anthropic (Claude)' : 'Ollama')
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

    // Info note for OpenAI
    div(
      { style: () => llmConfigStore.provider.val === 'openai' ? infoStyle : 'display: none;' },
      p({ style: 'margin: 0;' },
        chrome.i18n.getMessage('openaiNote') ||
        'Note: Works with any OpenAI-compatible API (OpenAI, Azure OpenAI, OpenRouter, local LLMs). Your API key is encrypted and stored locally.'
      )
    ),

    // Language info section
    div({ style: 'margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee;' },
      div({ style: sectionStyle },
        label({ style: labelStyle },
          chrome.i18n.getMessage('languageLabel') || 'Language'
        ),
        div({ style: 'padding: 8px 12px; background: #f5f5f5; border-radius: 6px; font-size: 14px;' },
          chrome.i18n.getUILanguage().startsWith('fr') ? 'Français' : 'English'
        ),
        p({ style: 'margin: 6px 0 0 0; font-size: 11px; color: #666;' },
          chrome.i18n.getUILanguage().startsWith('fr')
            ? 'La langue suit les paramètres de votre navigateur Chrome (chrome://settings/languages)'
            : 'Language follows your Chrome browser settings (chrome://settings/languages)'
        )
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
            openaiModels.val = [];
            openaiModelsStatus.val = null;
            openaiModelSearch.val = '';
            claudeModels.val = [];
            claudeModelsStatus.val = null;
            claudeModelSearch.val = '';
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
