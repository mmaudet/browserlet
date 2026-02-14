/**
 * LLM Settings UI Component
 * Allows configuring LLM provider, API keys, and model selection
 */

import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import {
  llmConfigStore,
  saveLLMConfig,
  loadLLMConfig,
} from '../stores/llmConfig';
import type { ProviderName } from '../../background/llm/providers/types';
import { resetAllExtensionData } from '../../../utils/storage/reset';

/** Anthropic API base URL */
const ANTHROPIC_API_BASE = 'https://api.anthropic.com';

/** Helper to format label with colon (French requires space before colon) */
const formatLabelWithColon = (label: string): string => {
  const isFrench = chrome.i18n.getUILanguage().startsWith('fr');
  return isFrench ? `${label} :` : `${label}:`;
};

// Styles
const containerStyle = { padding: '16px' };
const sectionStyle = { marginBottom: '20px' };
const labelStyle = { display: 'block', fontWeight: 500, marginBottom: '6px', color: '#333', fontSize: '13px' };
const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' as const };
const selectStyle = inputStyle;
const btnPrimaryStyle = { width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' };
const btnPrimarySmallStyle = { padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' };
const btnDangerStyle = { padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' };
const btnDisabledStyle = { opacity: 0.6, cursor: 'not-allowed' };
const warningStyle = { backgroundColor: '#fff3cd', border: '1px solid #ffc107', padding: '12px', borderRadius: '6px', marginBottom: '16px' };
const successStyle = { backgroundColor: '#d4edda', border: '1px solid #28a745', padding: '12px', borderRadius: '6px', marginBottom: '16px', color: '#155724' };
const errorStyle = { backgroundColor: '#f8d7da', border: '1px solid #dc3545', padding: '12px', borderRadius: '6px', marginBottom: '16px', color: '#721c24' };
const infoStyle = { backgroundColor: '#e7f3ff', border: '1px solid #0066cc', padding: '12px', borderRadius: '6px', marginTop: '16px', fontSize: '12px', color: '#004085' };

/**
 * LLM Settings component
 * Provides UI for configuring LLM provider and credentials
 */
export function LLMSettings() {
  // Local state for feedback - use useSignal() to persist across renders
  const saveSuccess = useSignal(false);
  const resetSuccess = useSignal(false);
  const testingConnection = useSignal(false);
  const connectionStatus = useSignal<string | null>(null);
  const ollamaModels = useSignal<string[]>([]);
  const loadingModels = useSignal(false);

  // OpenAI models state
  const openaiModels = useSignal<string[]>([]);
  const openaiModelsLoading = useSignal(false);
  const openaiModelsStatus = useSignal<string | null>(null);
  const openaiModelSearch = useSignal<string>('');

  // Claude/Anthropic models state
  const claudeModels = useSignal<string[]>([]);
  const claudeModelsLoading = useSignal(false);
  const claudeModelsStatus = useSignal<string | null>(null);
  const claudeModelSearch = useSignal<string>('');

  // Save button visibility
  const showSaveButton = useSignal(false);

  // Initialize on mount
  useEffect(() => {
    loadLLMConfig().catch(console.error);
  }, []);

  // Fetch Ollama models from the API
  const fetchOllamaModels = async () => {
    loadingModels.value = true;
    try {
      const host = llmConfigStore.ollamaHost.value;
      const response = await fetch(`${host}/api/tags`, { method: 'GET' });
      if (response.ok) {
        const data = await response.json();
        const models = (data.models || []).map((m: { name: string }) => m.name);
        ollamaModels.value = models;
        return models;
      }
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
    } finally {
      loadingModels.value = false;
    }
    return [];
  };

  const handleSave = async () => {
    saveSuccess.value = false;
    showSaveButton.value = false;

    try {
      await saveLLMConfig();
      saveSuccess.value = true;
      setTimeout(() => { saveSuccess.value = false; }, 3000);
    } catch (error) {
      console.error('Failed to save LLM config:', error);
    } finally {
      showSaveButton.value = true;
    }
  };

  // Derive models endpoint from chat completions endpoint
  const getModelsEndpoint = (chatEndpoint: string): string => {
    // Replace /chat/completions with /models
    return chatEndpoint.replace(/\/chat\/completions\/?$/, '/models');
  };

  // Fetch OpenAI-compatible models from the API
  const fetchOpenaiModels = async () => {
    const endpoint = llmConfigStore.openaiEndpoint.value;
    const apiKey = llmConfigStore.openaiApiKey.value;

    if (!endpoint || !apiKey) {
      openaiModelsStatus.value = 'Please enter endpoint and API key first';
      return;
    }

    openaiModelsLoading.value = true;
    openaiModelsStatus.value = null;
    openaiModelSearch.value = '';

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
        openaiModelsStatus.value = 'Connected but no models found';
        openaiModels.value = [];
        return;
      }

      openaiModels.value = models;
      openaiModelsStatus.value = `${models.length} model(s) available`;

      // Auto-select first model if current model is not in the list
      if (!llmConfigStore.openaiModel.value || !models.includes(llmConfigStore.openaiModel.value)) {
        // Try to find a good default (gpt-4o, gpt-4, etc.)
        const preferredModels = ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
        const defaultModel = preferredModels.find(m => models.includes(m)) || models[0];
        llmConfigStore.openaiModel.value = defaultModel;
      }

      showSaveButton.value = true;
    } catch (error) {
      console.error('[LLM Settings] Failed to fetch OpenAI models:', error);
      openaiModelsStatus.value = error instanceof Error ? error.message : 'Connection failed';
      openaiModels.value = [];
    } finally {
      openaiModelsLoading.value = false;
    }
  };

  // Filter models based on search
  const getFilteredOpenaiModels = (): string[] => {
    const search = openaiModelSearch.value.toLowerCase();
    if (!search) return openaiModels.value;
    return openaiModels.value.filter(m => m.toLowerCase().includes(search));
  };

  // Fetch Claude/Anthropic models from the API
  const fetchClaudeModels = async () => {
    const apiKey = llmConfigStore.claudeApiKey.value;

    if (!apiKey) {
      claudeModelsStatus.value = 'Please enter API key first';
      return;
    }

    claudeModelsLoading.value = true;
    claudeModelsStatus.value = null;
    claudeModelSearch.value = '';

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
        claudeModelsStatus.value = 'Connected but no models found';
        claudeModels.value = [];
        return;
      }

      claudeModels.value = models;
      claudeModelsStatus.value = `${models.length} model(s) available`;

      // Auto-select a good default if current model is not in the list
      if (!llmConfigStore.claudeModel.value || !models.includes(llmConfigStore.claudeModel.value)) {
        // Try to find a good default (claude-sonnet-4, claude-3-5-sonnet, etc.)
        const preferredModels = ['claude-sonnet-4-5-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'];
        const defaultModel = preferredModels.find(m => models.includes(m)) || models[0];
        llmConfigStore.claudeModel.value = defaultModel;
      }

      showSaveButton.value = true;
    } catch (error) {
      console.error('[LLM Settings] Failed to fetch Claude models:', error);
      claudeModelsStatus.value = error instanceof Error ? error.message : 'Connection failed';
      claudeModels.value = [];
    } finally {
      claudeModelsLoading.value = false;
    }
  };

  // Filter Claude models based on search
  const getFilteredClaudeModels = (): string[] => {
    const search = claudeModelSearch.value.toLowerCase();
    if (!search) return claudeModels.value;
    return claudeModels.value.filter(m => m.toLowerCase().includes(search));
  };

  const testOllamaConnection = async () => {
    testingConnection.value = true;
    connectionStatus.value = null;
    try {
      const models = await fetchOllamaModels();
      if (models.length > 0) {
        connectionStatus.value = `Connected! ${models.length} model(s) available.`;
        // Auto-select first model if none selected
        if (!llmConfigStore.ollamaModel.value || !models.includes(llmConfigStore.ollamaModel.value)) {
          llmConfigStore.ollamaModel.value = models[0];
        }
        showSaveButton.value = true;
      } else {
        connectionStatus.value = 'Connected but no models found. Run: ollama pull llama3.1';
      }
    } catch {
      connectionStatus.value = 'Connection failed: Cannot reach Ollama server';
    } finally {
      testingConnection.value = false;
    }
  };

  const handleReset = async () => {
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
      ollamaModels.value = [];
      openaiModels.value = [];
      openaiModelsStatus.value = null;
      openaiModelSearch.value = '';
      claudeModels.value = [];
      claudeModelsStatus.value = null;
      claudeModelSearch.value = '';
      connectionStatus.value = null;
      resetSuccess.value = true;
      // Reload the sidepanel after a short delay to refresh all state
      setTimeout(() => { window.location.reload(); }, 1500);
    }
  };

  const currentProvider = llmConfigStore.provider.value;

  return (
    <div style={containerStyle}>
      {/* Header */}
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>
        {chrome.i18n.getMessage('llmSettingsTitle') || 'LLM Settings'}
      </h3>

      {/* API key warning (show if needsApiKey is true) */}
      {llmConfigStore.needsApiKey.value && (
        <div style={warningStyle}>
          <p style={{ margin: '0 0 4px 0', fontWeight: 500 }}>
            {chrome.i18n.getMessage('apiKeyRequired') || 'API Key Required'}
          </p>
          <p style={{ margin: 0, fontSize: '13px' }}>
            {chrome.i18n.getMessage('apiKeyExpired') || 'Your API key needs to be re-entered after browser restart.'}
          </p>
        </div>
      )}

      {/* Save success message */}
      {saveSuccess.value && (
        <div style={successStyle}>
          {chrome.i18n.getMessage('settingsSaved') || 'Settings saved successfully!'}
        </div>
      )}

      {/* Save error message */}
      {llmConfigStore.saveError.value && (
        <div style={errorStyle}>
          {llmConfigStore.saveError.value}
        </div>
      )}

      {/* Provider selection */}
      <div style={sectionStyle}>
        <label style={labelStyle}>
          {chrome.i18n.getMessage('llmProvider') || 'LLM Provider'}
        </label>
        <select
          style={selectStyle}
          value={llmConfigStore.provider.value}
          onChange={(e: Event) => {
            const newValue = (e.target as HTMLSelectElement).value as ProviderName;
            llmConfigStore.provider.value = newValue;
            // Clear model lists when switching providers
            openaiModels.value = [];
            openaiModelsStatus.value = null;
            openaiModelSearch.value = '';
            claudeModels.value = [];
            claudeModelsStatus.value = null;
            claudeModelSearch.value = '';
            ollamaModels.value = [];
            connectionStatus.value = null;
            showSaveButton.value = false;
          }}
        >
          <option value="openai">OpenAI Compatible</option>
          <option value="claude">Anthropic (Claude)</option>
          <option value="ollama">Ollama (Local)</option>
        </select>
      </div>

      {/* Claude/Anthropic-specific settings */}
      {currentProvider === 'claude' && (
        <div>
          {/* API Key input */}
          <div style={sectionStyle}>
            <label style={labelStyle}>
              {chrome.i18n.getMessage('apiKey') || 'API Key'}
            </label>
            <input
              type="password"
              style={inputStyle}
              placeholder="sk-ant-..."
              value={llmConfigStore.claudeApiKey.value}
              onInput={(e: Event) => {
                llmConfigStore.claudeApiKey.value = (e.target as HTMLInputElement).value;
              }}
            />
            <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#666' }}>
              {chrome.i18n.getMessage('apiKeyHint') || 'Get your API key from console.anthropic.com'}
            </p>
          </div>

          {/* Fetch models button (show when API key is entered) */}
          {llmConfigStore.claudeApiKey.value && (
            <div style={{ marginBottom: '16px' }}>
              <button
                style={{
                  ...btnPrimarySmallStyle,
                  ...(claudeModelsLoading.value ? btnDisabledStyle : {})
                }}
                disabled={claudeModelsLoading.value}
                onClick={fetchClaudeModels}
              >
                {claudeModelsLoading.value
                  ? (chrome.i18n.getMessage('loadingModels') || 'Loading models...')
                  : (chrome.i18n.getMessage('fetchModels') || 'Fetch Available Models')
                }
              </button>
              {claudeModelsStatus.value && (
                <span style={{
                  marginLeft: '12px',
                  fontSize: '13px',
                  color: claudeModelsStatus.value.includes('available') ? '#28a745' : '#dc3545'
                }}>
                  {claudeModelsStatus.value}
                </span>
              )}
            </div>
          )}

          {/* Claude model selection (show only when models have been fetched) */}
          {claudeModels.value.length > 0 && (
            <div style={sectionStyle}>
              <label style={labelStyle}>
                {chrome.i18n.getMessage('llmModel') || 'Model'}
              </label>
              {/* Search input */}
              <input
                type="text"
                style={{ ...inputStyle, marginBottom: '8px' }}
                placeholder={chrome.i18n.getMessage('searchModels') || 'Search models...'}
                value={claudeModelSearch.value}
                onInput={(e: Event) => {
                  claudeModelSearch.value = (e.target as HTMLInputElement).value;
                }}
              />
              {/* Model select dropdown */}
              {(() => {
                const filtered = getFilteredClaudeModels();
                return (
                  <div>
                    <select
                      style={selectStyle}
                      value={llmConfigStore.claudeModel.value}
                      onChange={(e: Event) => {
                        llmConfigStore.claudeModel.value = (e.target as HTMLSelectElement).value;
                      }}
                    >
                      {filtered.length === 0 ? (
                        <option value="" disabled>No models match search</option>
                      ) : (
                        filtered.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))
                      )}
                    </select>
                    <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#666' }}>
                      {`${filtered.length} of ${claudeModels.value.length} models shown`}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Ollama-specific settings */}
      {currentProvider === 'ollama' && (
        <div>
          {/* Host input */}
          <div style={sectionStyle}>
            <label style={labelStyle}>
              {chrome.i18n.getMessage('ollamaHost') || 'Ollama Host'}
            </label>
            <input
              type="text"
              style={inputStyle}
              placeholder="http://localhost:11434"
              value={llmConfigStore.ollamaHost.value}
              onInput={(e: Event) => {
                llmConfigStore.ollamaHost.value = (e.target as HTMLInputElement).value;
              }}
            />
          </div>

          {/* Test connection button (before model selection) */}
          <div style={{ marginBottom: '16px' }}>
            <button
              style={{
                ...btnPrimarySmallStyle,
                ...(testingConnection.value ? btnDisabledStyle : {})
              }}
              disabled={testingConnection.value}
              onClick={testOllamaConnection}
            >
              {testingConnection.value
                ? (chrome.i18n.getMessage('testing') || 'Testing...')
                : (chrome.i18n.getMessage('testConnection') || 'Test Connection')
              }
            </button>
            {connectionStatus.value && (
              <span style={{
                marginLeft: '12px',
                fontSize: '13px',
                color: connectionStatus.value.startsWith('Connected') ? '#28a745' : '#dc3545'
              }}>
                {connectionStatus.value}
              </span>
            )}
          </div>

          {/* Model selection (populated after connection test) */}
          <div style={sectionStyle}>
            <label style={labelStyle}>
              {chrome.i18n.getMessage('ollamaModel') || 'Model'}
            </label>
            {ollamaModels.value.length > 0 ? (
              <select
                style={selectStyle}
                value={llmConfigStore.ollamaModel.value}
                onChange={(e: Event) => {
                  llmConfigStore.ollamaModel.value = (e.target as HTMLSelectElement).value;
                }}
              >
                {ollamaModels.value.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            ) : (
              <div>
                <input
                  type="text"
                  style={inputStyle}
                  placeholder="llama3.1"
                  value={llmConfigStore.ollamaModel.value}
                  onInput={(e: Event) => {
                    llmConfigStore.ollamaModel.value = (e.target as HTMLInputElement).value;
                  }}
                />
                <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#666' }}>
                  {chrome.i18n.getMessage('loadModelsHint') || 'Click "Test Connection" to load available models'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OpenAI-compatible settings */}
      {currentProvider === 'openai' && (
        <div>
          {/* Endpoint input */}
          <div style={sectionStyle}>
            <label style={labelStyle}>
              {chrome.i18n.getMessage('openaiEndpoint') || 'API Endpoint'}
            </label>
            <input
              type="text"
              style={inputStyle}
              placeholder="https://api.openai.com/v1/chat/completions"
              value={llmConfigStore.openaiEndpoint.value}
              onInput={(e: Event) => {
                llmConfigStore.openaiEndpoint.value = (e.target as HTMLInputElement).value;
              }}
            />
            <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#666' }}>
              {chrome.i18n.getMessage('openaiEndpointHint') || 'Chat completions endpoint (OpenAI, Azure, OpenRouter, etc.)'}
            </p>
          </div>

          {/* API Key input */}
          <div style={sectionStyle}>
            <label style={labelStyle}>
              {chrome.i18n.getMessage('apiKey') || 'API Key'}
            </label>
            <input
              type="password"
              style={inputStyle}
              placeholder="sk-..."
              value={llmConfigStore.openaiApiKey.value}
              onInput={(e: Event) => {
                llmConfigStore.openaiApiKey.value = (e.target as HTMLInputElement).value;
              }}
            />
          </div>

          {/* Fetch models button (show when endpoint and API key are entered) */}
          {llmConfigStore.openaiEndpoint.value && llmConfigStore.openaiApiKey.value && (
            <div style={{ marginBottom: '16px' }}>
              <button
                style={{
                  ...btnPrimarySmallStyle,
                  ...(openaiModelsLoading.value ? btnDisabledStyle : {})
                }}
                disabled={openaiModelsLoading.value}
                onClick={fetchOpenaiModels}
              >
                {openaiModelsLoading.value
                  ? (chrome.i18n.getMessage('loadingModels') || 'Loading models...')
                  : (chrome.i18n.getMessage('fetchModels') || 'Fetch Available Models')
                }
              </button>
              {openaiModelsStatus.value && (
                <span style={{
                  marginLeft: '12px',
                  fontSize: '13px',
                  color: openaiModelsStatus.value.includes('available') ? '#28a745' : '#dc3545'
                }}>
                  {openaiModelsStatus.value}
                </span>
              )}
            </div>
          )}

          {/* Model selection (show only when models have been fetched) */}
          {openaiModels.value.length > 0 && (
            <div style={sectionStyle}>
              <label style={labelStyle}>
                {chrome.i18n.getMessage('openaiModel') || 'Model'}
              </label>
              {/* Search input */}
              <input
                type="text"
                style={{ ...inputStyle, marginBottom: '8px' }}
                placeholder={chrome.i18n.getMessage('searchModels') || 'Search models...'}
                value={openaiModelSearch.value}
                onInput={(e: Event) => {
                  openaiModelSearch.value = (e.target as HTMLInputElement).value;
                }}
              />
              {/* Model select dropdown */}
              {(() => {
                const filtered = getFilteredOpenaiModels();
                return (
                  <div>
                    <select
                      style={selectStyle}
                      value={llmConfigStore.openaiModel.value}
                      onChange={(e: Event) => {
                        llmConfigStore.openaiModel.value = (e.target as HTMLSelectElement).value;
                      }}
                    >
                      {filtered.length === 0 ? (
                        <option value="" disabled>No models match search</option>
                      ) : (
                        filtered.map(model => (
                          <option key={model} value={model}>{model}</option>
                        ))
                      )}
                    </select>
                    <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#666' }}>
                      {`${filtered.length} of ${openaiModels.value.length} models shown`}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Fallback generator option */}
      <div style={{ ...sectionStyle, marginTop: '20px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #e9ecef' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={llmConfigStore.useFallbackGenerator.value}
            onChange={(e: Event) => {
              llmConfigStore.useFallbackGenerator.value = (e.target as HTMLInputElement).checked;
              showSaveButton.value = true;
            }}
            style={{ marginRight: '10px', marginTop: '2px' }}
          />
          <div>
            <span style={{ fontWeight: 500, fontSize: '13px' }}>
              {chrome.i18n.getMessage('useFallbackGenerator') || 'Use Fallback Generator (more reliable)'}
            </span>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>
              {chrome.i18n.getMessage('fallbackGeneratorHint') ||
              'Skip LLM and generate BSL directly from recorded actions. More deterministic and reliable, but less optimized.'}
            </p>
          </div>
        </label>
      </div>

      {/* Save button (only show when configuration is complete) */}
      {showSaveButton.value && (
        <div>
          <button
            style={btnPrimaryStyle}
            onClick={handleSave}
          >
            {chrome.i18n.getMessage('saveSettings') || 'Save Settings'}
          </button>
        </div>
      )}

      {/* Status section */}
      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
        <div style={{ fontSize: '13px', color: '#666' }}>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontWeight: 500 }}>
              {formatLabelWithColon(chrome.i18n.getMessage('statusLabel') || 'Status') + ' '}
            </span>
            <span style={{ color: (llmConfigStore.isConfigured.value || llmConfigStore.useFallbackGenerator.value) ? '#28a745' : '#dc3545' }}>
              {(llmConfigStore.isConfigured.value || llmConfigStore.useFallbackGenerator.value)
                ? (chrome.i18n.getMessage('statusConfigured') || 'Configured')
                : (chrome.i18n.getMessage('statusNotConfigured') || 'Not configured')
              }
            </span>
          </div>
          <div>
            <span style={{ fontWeight: 500 }}>
              {formatLabelWithColon(chrome.i18n.getMessage('providerLabel') || 'Provider') + ' '}
            </span>
            <span>
              {(() => {
                if (llmConfigStore.useFallbackGenerator.value) {
                  return chrome.i18n.getMessage('fallbackGeneratorActive') || 'Fallback Generator (no LLM)';
                }
                const provider = llmConfigStore.provider.value;
                const providerName = provider === 'openai' ? 'OpenAI Compatible' :
                                     provider === 'claude' ? 'Anthropic (Claude)' : 'Ollama';
                const modelName = provider === 'openai' ? llmConfigStore.openaiModel.value :
                                  provider === 'claude' ? llmConfigStore.claudeModel.value :
                                  llmConfigStore.ollamaModel.value;
                return modelName ? `${providerName} - ${modelName}` : providerName;
              })()}
            </span>
          </div>
        </div>
      </div>

      {/* Info note for Claude */}
      {currentProvider === 'claude' && (
        <div style={infoStyle}>
          <p style={{ margin: 0 }}>
            {chrome.i18n.getMessage('sessionKeyNote') ||
            'Note: Your API key is encrypted and stored locally. After browser restart, you will need to re-enter your API key for security.'}
          </p>
        </div>
      )}

      {/* Info note for OpenAI */}
      {currentProvider === 'openai' && (
        <div style={infoStyle}>
          <p style={{ margin: 0 }}>
            {chrome.i18n.getMessage('openaiNote') ||
            'Note: Works with any OpenAI-compatible API (OpenAI, Azure OpenAI, OpenRouter, local LLMs). Your API key is encrypted and stored locally.'}
          </p>
        </div>
      )}

      {/* Language info section */}
      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
        <div style={sectionStyle}>
          <label style={labelStyle}>
            {chrome.i18n.getMessage('languageLabel') || 'Language'}
          </label>
          <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: '6px', fontSize: '14px' }}>
            {chrome.i18n.getUILanguage().startsWith('fr') ? 'Francais' : 'English'}
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '11px', color: '#666' }}>
            {chrome.i18n.getUILanguage().startsWith('fr')
              ? 'La langue suit les parametres de votre navigateur Chrome (chrome://settings/languages)'
              : 'Language follows your Chrome browser settings (chrome://settings/languages)'}
          </p>
        </div>
      </div>

      {/* Reset section */}
      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#d32f2f' }}>
          {chrome.i18n.getMessage('dangerZone') || 'Danger Zone'}
        </h3>
        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#666' }}>
          {chrome.i18n.getMessage('resetWarning') || 'This will permanently delete ALL extension data: scripts, settings, triggers, and history.'}
        </p>
        {resetSuccess.value && (
          <div style={successStyle}>
            {chrome.i18n.getMessage('resetSuccess') || 'All data has been reset. Reloading...'}
          </div>
        )}
        <button
          style={btnDangerStyle}
          onClick={handleReset}
        >
          {chrome.i18n.getMessage('resetAllData') || 'Reset All Data'}
        </button>
      </div>
    </div>
  );
}
