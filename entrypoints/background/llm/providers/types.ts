/**
 * LLM Provider types and configuration interfaces
 */

import type { CapturedAction } from '../../../content/recording/types';

/**
 * Supported LLM provider names
 */
export type ProviderName = 'claude' | 'ollama' | 'openai';

/**
 * LLM Provider interface
 * All providers must implement this contract
 */
export interface LLMProvider {
  /** Provider identifier */
  name: ProviderName;

  /**
   * Generate BSL script from captured actions
   * @param actions - Array of captured user actions
   * @returns Promise resolving to BSL YAML string
   */
  generateBSL(actions: CapturedAction[]): Promise<string>;

  /**
   * Check if provider is available and configured
   * @returns Promise resolving to availability status
   */
  isAvailable(): Promise<boolean>;
}

/**
 * LLM configuration stored in chrome.storage
 */
export interface LLMConfig {
  /** Active provider selection */
  provider: ProviderName;

  /** Claude API key (encrypted in storage) */
  claudeApiKey?: string;

  /** Claude model to use (default: claude-sonnet-4-5-20250929) */
  claudeModel?: string;

  /** Ollama server host (default: http://localhost:11434) */
  ollamaHost?: string;

  /** Ollama model to use (default: llama3.1) */
  ollamaModel?: string;

  /** OpenAI-compatible API endpoint (e.g., https://api.openai.com/v1/chat/completions) */
  openaiEndpoint?: string;

  /** OpenAI-compatible API key (encrypted in storage) */
  openaiApiKey?: string;

  /** OpenAI-compatible model name (default: gpt-4) */
  openaiModel?: string;
}

/**
 * Default LLM configuration values
 */
export const DEFAULT_LLM_CONFIG: Partial<LLMConfig> = {
  provider: 'claude',
  claudeModel: 'claude-sonnet-4-5-20250929',
  ollamaHost: 'http://localhost:11434',
  ollamaModel: 'llama3.1',
  openaiEndpoint: 'https://api.openai.com/v1/chat/completions',
  openaiModel: 'gpt-4o',
};

// Re-export CapturedAction for convenience
export type { CapturedAction };
