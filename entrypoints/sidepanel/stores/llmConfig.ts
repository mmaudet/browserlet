/**
 * LLM Configuration Store with encrypted API key storage
 * Uses VanJS reactive pattern for state management
 */

import van from 'vanjs-core';
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
 */
export const llmConfigStore = {
  /** Selected provider */
  provider: van.state<ProviderName>('claude'),
  /** Decrypted Claude API key (in memory only) */
  claudeApiKey: van.state<string>(''),
  /** Claude model */
  claudeModel: van.state<string>('claude-sonnet-4-5-20250514'),
  /** Ollama server host */
  ollamaHost: van.state<string>('http://localhost:11434'),
  /** Ollama model name */
  ollamaModel: van.state<string>('llama3.1'),
  /** OpenAI-compatible API endpoint */
  openaiEndpoint: van.state<string>('https://api.openai.com/v1/chat/completions'),
  /** Decrypted OpenAI API key (in memory only) */
  openaiApiKey: van.state<string>(''),
  /** OpenAI-compatible model name */
  openaiModel: van.state<string>('gpt-4o'),
  /** Whether LLM is configured and ready */
  isConfigured: van.state<boolean>(false),
  /** True if encrypted key exists but can't decrypt (new session key) */
  needsApiKey: van.state<boolean>(false),
  /** Save in progress */
  isSaving: van.state<boolean>(false),
  /** Last save error */
  saveError: van.state<string | null>(null),
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
    llmConfigStore.isConfigured.val = false;
    return;
  }

  // Load basic config values
  llmConfigStore.provider.val = stored.provider ?? 'claude';
  llmConfigStore.claudeModel.val = stored.claudeModel ?? 'claude-sonnet-4-5-20250929';
  llmConfigStore.ollamaHost.val = stored.ollamaHost ?? 'http://localhost:11434';
  llmConfigStore.ollamaModel.val = stored.ollamaModel ?? 'llama3.1';
  llmConfigStore.openaiEndpoint.val = stored.openaiEndpoint ?? 'https://api.openai.com/v1/chat/completions';
  llmConfigStore.openaiModel.val = stored.openaiModel ?? 'gpt-4o';

  // Handle API key decryption for Claude
  if (stored.provider === 'claude' && stored.encryptedApiKey) {
    try {
      const decrypted = await decryptApiKey(stored.encryptedApiKey);
      llmConfigStore.claudeApiKey.val = decrypted;
      llmConfigStore.needsApiKey.val = false;
      llmConfigStore.isConfigured.val = true;
    } catch {
      // Decryption failed - likely new session key after browser restart
      llmConfigStore.claudeApiKey.val = '';
      llmConfigStore.needsApiKey.val = true;
      llmConfigStore.isConfigured.val = false;
    }
  } else if (stored.provider === 'ollama') {
    // Ollama doesn't need credentials
    llmConfigStore.needsApiKey.val = false;
    llmConfigStore.isConfigured.val = true;
  } else if (stored.provider === 'openai' && stored.encryptedOpenaiApiKey) {
    try {
      const decrypted = await decryptApiKey(stored.encryptedOpenaiApiKey);
      llmConfigStore.openaiApiKey.val = decrypted;
      llmConfigStore.needsApiKey.val = false;
      llmConfigStore.isConfigured.val = true;
    } catch {
      // Decryption failed - likely new session key after browser restart
      llmConfigStore.openaiApiKey.val = '';
      llmConfigStore.needsApiKey.val = true;
      llmConfigStore.isConfigured.val = false;
    }
  }
}

/**
 * Save LLM configuration to storage
 * Encrypts API key before storing
 * Also sends CONFIGURE_LLM message to service worker
 * @param providerOverride - Optional provider override (workaround for VanJS cross-module state issues)
 */
export async function saveLLMConfig(providerOverride?: ProviderName): Promise<void> {
  llmConfigStore.isSaving.val = true;
  llmConfigStore.saveError.val = null;

  // Use override if provided, otherwise fall back to store value
  const provider = providerOverride ?? llmConfigStore.provider.val;

  try {
    const storedConfig: StoredLLMConfig = {
      provider: provider,
      claudeModel: llmConfigStore.claudeModel.val,
      ollamaHost: llmConfigStore.ollamaHost.val,
      ollamaModel: llmConfigStore.ollamaModel.val,
      openaiEndpoint: llmConfigStore.openaiEndpoint.val,
      openaiModel: llmConfigStore.openaiModel.val,
    };

    // Encrypt API key if Claude provider and key is provided
    if (provider === 'claude' && llmConfigStore.claudeApiKey.val) {
      storedConfig.encryptedApiKey = await encryptApiKey(llmConfigStore.claudeApiKey.val);
    }

    // Encrypt API key if OpenAI provider and key is provided
    if (provider === 'openai' && llmConfigStore.openaiApiKey.val) {
      storedConfig.encryptedOpenaiApiKey = await encryptApiKey(llmConfigStore.openaiApiKey.val);
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

    llmConfigStore.needsApiKey.val = false;
    llmConfigStore.isConfigured.val = true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    llmConfigStore.saveError.val = errorMessage;
    throw error;
  } finally {
    llmConfigStore.isSaving.val = false;
  }
}

/**
 * Get LLM configuration for sending to service worker
 * Includes decrypted API key (for in-memory use only)
 * @param providerOverride - Optional provider override (workaround for VanJS cross-module state issues)
 */
export function getLLMConfigForServiceWorker(providerOverride?: ProviderName): LLMConfig {
  const provider = providerOverride ?? llmConfigStore.provider.val;
  return {
    provider: provider,
    claudeApiKey: provider === 'claude' ? llmConfigStore.claudeApiKey.val : undefined,
    claudeModel: llmConfigStore.claudeModel.val,
    ollamaHost: llmConfigStore.ollamaHost.val,
    ollamaModel: llmConfigStore.ollamaModel.val,
    openaiEndpoint: llmConfigStore.openaiEndpoint.val,
    openaiApiKey: provider === 'openai' ? llmConfigStore.openaiApiKey.val : undefined,
    openaiModel: llmConfigStore.openaiModel.val,
  };
}

/**
 * Check if current configuration is valid
 * Claude requires API key, Ollama just needs to be selected
 */
export function isConfigValid(): boolean {
  if (llmConfigStore.provider.val === 'claude') {
    return !!llmConfigStore.claudeApiKey.val;
  }
  if (llmConfigStore.provider.val === 'openai') {
    return !!llmConfigStore.openaiApiKey.val && !!llmConfigStore.openaiEndpoint.val;
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
  llmConfigStore.provider.val = 'claude';
  llmConfigStore.claudeApiKey.val = '';
  llmConfigStore.claudeModel.val = 'claude-sonnet-4-5-20250929';
  llmConfigStore.ollamaHost.val = 'http://localhost:11434';
  llmConfigStore.ollamaModel.val = 'llama3.1';
  llmConfigStore.openaiEndpoint.val = 'https://api.openai.com/v1/chat/completions';
  llmConfigStore.openaiApiKey.val = '';
  llmConfigStore.openaiModel.val = 'gpt-4o';
  llmConfigStore.isConfigured.val = false;
  llmConfigStore.needsApiKey.val = false;
  llmConfigStore.saveError.val = null;
}

// Listen for storage changes to sync LLM config across views
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    // Reload config when it changes in storage
    loadLLMConfig().catch(console.error);
  }
});
