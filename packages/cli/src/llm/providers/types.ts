/**
 * LLM Provider types and configuration interfaces for CLI
 *
 * Mirrors extension provider abstraction but adapted for Node.js server-side execution.
 * No browser-specific APIs, synchronous availability checks preferred.
 */

/**
 * Supported LLM provider names
 */
export type ProviderName = 'claude' | 'ollama';

/**
 * LLM Provider interface
 * All providers must implement this contract for micro-prompt routing
 */
export interface LLMProvider {
  /** Provider identifier */
  name: ProviderName;

  /**
   * Check if provider is available and configured
   * @returns Promise resolving to availability status
   */
  isAvailable(): Promise<boolean>;

  /**
   * Generate raw text response from a prompt
   * @param prompt - The prompt to send to the LLM
   * @returns Promise resolving to raw text response
   */
  generate(prompt: string): Promise<string>;
}

/**
 * LLM configuration for CLI
 */
export interface LLMConfig {
  /** Active provider selection */
  provider: ProviderName;

  /** Claude API key */
  claudeApiKey?: string;

  /** Claude model to use (default: claude-sonnet-4-5-20250929) */
  claudeModel?: string;

  /** Ollama server host (default: http://localhost:11434) */
  ollamaHost?: string;

  /** Ollama model to use (default: llama3.1) */
  ollamaModel?: string;
}

/**
 * Default LLM configuration values
 */
export const DEFAULT_LLM_CONFIG: Partial<LLMConfig> = {
  provider: 'claude',
  claudeModel: 'claude-sonnet-4-5-20250929',
  ollamaHost: 'http://localhost:11434',
  ollamaModel: 'llama3.1',
};
