/**
 * Ollama local LLM provider implementation
 * Uses ollama/browser package for local model inference
 */

import { Ollama } from 'ollama/browser';
import yaml from 'js-yaml';
import { buildBSLPrompt } from '../promptBuilder';
import type { LLMProvider } from './types';
import type { CapturedAction } from '../../../content/recording/types';

/**
 * Ollama provider implementing LLMProvider interface
 *
 * Features:
 * - Connects to local Ollama server
 * - No rate limiting needed (local resource)
 * - YAML validation on generated BSL
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
    this.client = new Ollama({
      host: host ?? 'http://localhost:11434',
    });
    this.model = model ?? 'llama3.1';
  }

  /**
   * Check if Ollama server is available
   * @returns Promise resolving to availability status
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate BSL script from captured actions using Ollama
   * @param actions - Array of captured user actions
   * @returns Promise resolving to BSL YAML string
   * @throws Error if API call fails or generated BSL is invalid YAML
   */
  async generateBSL(actions: CapturedAction[]): Promise<string> {
    const prompt = buildBSLPrompt(actions);

    const response = await this.client.chat({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    });

    const bslContent = response.message.content;

    // Validate YAML structure
    try {
      yaml.load(bslContent);
    } catch {
      throw new Error('LLM generated invalid BSL');
    }

    return bslContent;
  }
}
