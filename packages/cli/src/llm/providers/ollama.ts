/**
 * Ollama local LLM provider implementation for CLI
 *
 * Uses ollama npm package (not browser variant) for Node.js server-side execution.
 * Connects to local Ollama server with no authentication required.
 */

import { Ollama } from 'ollama';
import type { LLMProvider } from './types.js';

/**
 * Ollama provider implementing LLMProvider interface
 *
 * Features:
 * - Connects to local Ollama server
 * - No rate limiting needed (local resource)
 * - Configurable host and model
 */
export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama' as const;

  private client: Ollama;
  private model: string;

  /**
   * Create a new Ollama provider
   * @param host - Ollama server host (default: http://localhost:11434)
   * @param model - Model to use (default: llama3.1)
   */
  constructor(host?: string, model?: string) {
    const actualHost = host ?? 'http://localhost:11434';
    const actualModel = model ?? 'llama3.1';
    console.log('[Ollama] Provider created with host:', actualHost, 'model:', actualModel);
    this.client = new Ollama({
      host: actualHost,
    });
    this.model = actualModel;
  }

  /**
   * Check if Ollama server is available
   * Returns true (local server, no auth required)
   * @returns Promise resolving to availability status
   */
  async isAvailable(): Promise<boolean> {
    // Local server, no auth required - assume available
    // Could optionally check with client.list() but adds latency
    return true;
  }

  /**
   * Generate raw text response from a prompt
   * @param prompt - The prompt to send to the LLM
   * @returns Promise resolving to raw text response
   */
  async generate(prompt: string): Promise<string> {
    console.log('[Ollama] generate called with prompt length:', prompt.length);

    const response = await this.client.chat({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    });

    return response.message.content;
  }
}
