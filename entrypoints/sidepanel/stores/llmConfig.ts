/**
 * LLM Configuration Store with encrypted API key storage
 * Uses Preact Signals for reliable cross-module state management
 */

import { signal } from '@preact/signals';
import {
  encryptApiKey,
  decryptApiKey,
  type EncryptedData,
} from '../../../utils/crypto/encryption';
import type { LLMConfig, ProviderName } from '../../background/llm/providers/types';

const STORAGE_KEY = 'browserlet_llm_config';

/**
 * Configuration as stored in chrome.storage.local
 * API key is encrypted, never stored in plaintext
 */
interface StoredLLMConfig {
  provider: ProviderName;
  claudeModel?: string;
  ollamaHost?: string;
  ollamaModel?: string;
  encryptedApiKey?: EncryptedData;
  openaiEndpoint?: string;
  openaiModel?: string;
  encryptedOpenaiApiKey?: EncryptedData;
}

/**
 * Reactive LLM configuration state
 * Using Preact Signals for reliable cross-module reactivity
 */
export const llmConfigStore = {
  /** Selected provider */
  provider: signal<ProviderName>('claude'),
  /** Decrypted Claude API key (in memory only) */
  claudeApiKey: signal<string>(''),
  /** Claude model */
  claudeModel: signal<string>('claude-sonnet-4-5-20250514'),
  /** Ollama server host */
  ollamaHost: signal<string>('http://localhost:11434'),
  /** Ollama model name */
  ollamaModel: signal<string>('llama3.1'),
  /** OpenAI-compatible API endpoint */
  openaiEndpoint: signal<string>('https://api.openai.com/v1/chat/completions'),
  /** Decrypted OpenAI API key (in memory only) */
  openaiApiKey: signal<string>(''),
  /** OpenAI-compatible model name */
  openaiModel: signal<string>('gpt-4o'),
  /** Whether LLM is configured and ready */
  isConfigured: signal<boolean>(false),
  /** True if encrypted key exists but can't decrypt (new session key) */
  needsApiKey: signal<boolean>(false),
  /** Save in progress */
  isSaving: signal<boolean>(false),
  /** Last save error */
  saveError: signal<string | null>(null),
};

/**
 * Load LLM configuration from storage
 * Attempts to decrypt API key if present
 */
export async function loadLLMConfig(): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY] as StoredLLMConfig | undefined;

  if (!stored) {
    // No config stored, use defaults
    llmConfigStore.isConfigured.value = false;
    return;
  }

  // Load basic config values
  llmConfigStore.provider.value = stored.provider ?? 'claude';
  llmConfigStore.claudeModel.value = stored.claudeModel ?? 'claude-sonnet-4-5-20250929';
  llmConfigStore.ollamaHost.value = stored.ollamaHost ?? 'http://localhost:11434';
  llmConfigStore.ollamaModel.value = stored.ollamaModel ?? 'llama3.1';
  llmConfigStore.openaiEndpoint.value = stored.openaiEndpoint ?? 'https://api.openai.com/v1/chat/completions';
  llmConfigStore.openaiModel.value = stored.openaiModel ?? 'gpt-4o';

  // Handle API key decryption for Claude
  let configuredSuccessfully = false;
  if (stored.provider === 'claude' && stored.encryptedApiKey) {
    try {
      const decrypted = await decryptApiKey(stored.encryptedApiKey);
      llmConfigStore.claudeApiKey.value = decrypted;
      llmConfigStore.needsApiKey.value = false;
      llmConfigStore.isConfigured.value = true;
      configuredSuccessfully = true;
    } catch {
      // Decryption failed - likely new session key after browser restart
      llmConfigStore.claudeApiKey.value = '';
      llmConfigStore.needsApiKey.value = true;
      llmConfigStore.isConfigured.value = false;
    }
  } else if (stored.provider === 'ollama') {
    // Ollama doesn't need credentials
    llmConfigStore.needsApiKey.value = false;
    llmConfigStore.isConfigured.value = true;
    configuredSuccessfully = true;
  } else if (stored.provider === 'openai' && stored.encryptedOpenaiApiKey) {
    try {
      const decrypted = await decryptApiKey(stored.encryptedOpenaiApiKey);
      llmConfigStore.openaiApiKey.value = decrypted;
      llmConfigStore.needsApiKey.value = false;
      llmConfigStore.isConfigured.value = true;
      configuredSuccessfully = true;
    } catch {
      // Decryption failed - likely new session key after browser restart
      llmConfigStore.openaiApiKey.value = '';
      llmConfigStore.needsApiKey.value = true;
      llmConfigStore.isConfigured.value = false;
    }
  }

  // Send config to background service worker if successfully loaded
  // This ensures background has the config after vault unlock
  if (configuredSuccessfully) {
    const config = getLLMConfigForServiceWorker(stored.provider);
    chrome.runtime.sendMessage({
      type: 'CONFIGURE_LLM',
      payload: config,
    }).catch(() => {
      // Background may not be ready yet - ignore
    });
  }
}

/**
 * Save LLM configuration to storage
 * Encrypts API key before storing
 * Also sends CONFIGURE_LLM message to service worker
 * @param providerOverride - Optional provider override (legacy parameter, Preact Signals fixes cross-module issues)
 */
export async function saveLLMConfig(providerOverride?: ProviderName): Promise<void> {
  llmConfigStore.isSaving.value = true;
  llmConfigStore.saveError.value = null;

  // Use override if provided, otherwise fall back to store value
  // Note: providerOverride is kept for API compatibility but Preact Signals
  // should now work reliably without needing workarounds
  const provider = providerOverride ?? llmConfigStore.provider.value;

  try {
    const storedConfig: StoredLLMConfig = {
      provider: provider,
      claudeModel: llmConfigStore.claudeModel.value,
      ollamaHost: llmConfigStore.ollamaHost.value,
      ollamaModel: llmConfigStore.ollamaModel.value,
      openaiEndpoint: llmConfigStore.openaiEndpoint.value,
      openaiModel: llmConfigStore.openaiModel.value,
    };

    // Encrypt API key if Claude provider and key is provided
    if (provider === 'claude' && llmConfigStore.claudeApiKey.value) {
      storedConfig.encryptedApiKey = await encryptApiKey(llmConfigStore.claudeApiKey.value);
    }

    // Encrypt API key if OpenAI provider and key is provided
    if (provider === 'openai' && llmConfigStore.openaiApiKey.value) {
      storedConfig.encryptedOpenaiApiKey = await encryptApiKey(llmConfigStore.openaiApiKey.value);
    }

    // Save to storage
    await chrome.storage.local.set({ [STORAGE_KEY]: storedConfig });

    // Configure the LLM service in the service worker
    const config = getLLMConfigForServiceWorker(provider);
    const response = await chrome.runtime.sendMessage({
      type: 'CONFIGURE_LLM',
      payload: config,
    });

    if (!response.success) {
      throw new Error(response.error ?? 'Failed to configure LLM service');
    }

    llmConfigStore.needsApiKey.value = false;
    llmConfigStore.isConfigured.value = true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    llmConfigStore.saveError.value = errorMessage;
    throw error;
  } finally {
    llmConfigStore.isSaving.value = false;
  }
}

/**
 * Get LLM configuration for sending to service worker
 * Includes decrypted API key (for in-memory use only)
 * @param providerOverride - Optional provider override (legacy parameter, Preact Signals fixes cross-module issues)
 */
export function getLLMConfigForServiceWorker(providerOverride?: ProviderName): LLMConfig {
  const provider = providerOverride ?? llmConfigStore.provider.value;
  return {
    provider: provider,
    claudeApiKey: provider === 'claude' ? llmConfigStore.claudeApiKey.value : undefined,
    claudeModel: llmConfigStore.claudeModel.value,
    ollamaHost: llmConfigStore.ollamaHost.value,
    ollamaModel: llmConfigStore.ollamaModel.value,
    openaiEndpoint: llmConfigStore.openaiEndpoint.value,
    openaiApiKey: provider === 'openai' ? llmConfigStore.openaiApiKey.value : undefined,
    openaiModel: llmConfigStore.openaiModel.value,
  };
}

/**
 * Check if current configuration is valid
 * Claude requires API key, Ollama just needs to be selected
 */
export function isConfigValid(): boolean {
  if (llmConfigStore.provider.value === 'claude') {
    return !!llmConfigStore.claudeApiKey.value;
  }
  if (llmConfigStore.provider.value === 'openai') {
    return !!llmConfigStore.openaiApiKey.value && !!llmConfigStore.openaiEndpoint.value;
  }
  return true; // Ollama doesn't require credentials
}

/**
 * Reset LLM configuration to defaults
 * Clears stored config and resets store state
 */
export async function resetLLMConfig(): Promise<void> {
  // Remove from storage
  await chrome.storage.local.remove(STORAGE_KEY);

  // Reset store to defaults
  llmConfigStore.provider.value = 'claude';
  llmConfigStore.claudeApiKey.value = '';
  llmConfigStore.claudeModel.value = 'claude-sonnet-4-5-20250929';
  llmConfigStore.ollamaHost.value = 'http://localhost:11434';
  llmConfigStore.ollamaModel.value = 'llama3.1';
  llmConfigStore.openaiEndpoint.value = 'https://api.openai.com/v1/chat/completions';
  llmConfigStore.openaiApiKey.value = '';
  llmConfigStore.openaiModel.value = 'gpt-4o';
  llmConfigStore.isConfigured.value = false;
  llmConfigStore.needsApiKey.value = false;
  llmConfigStore.saveError.value = null;
}

// Listen for storage changes to sync LLM config across views
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    // Reload config when it changes in storage
    loadLLMConfig().catch(console.error);
  }
});
