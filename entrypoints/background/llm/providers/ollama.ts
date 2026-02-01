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

  /**
   * Generate BSL script from captured actions using Ollama
   * @param actions - Array of captured user actions
   * @returns Promise resolving to BSL YAML string
   * @throws Error if API call fails or generated BSL is invalid YAML
   */
  async generateBSL(actions: CapturedAction[]): Promise<string> {
    console.log('[Ollama] generateBSL called with', actions.length, 'actions');
    console.log('[Ollama] Using model:', this.model);

    const prompt = buildBSLPrompt(actions);
    console.log('[Ollama] Prompt length:', prompt.length, 'chars');

    console.log('[Ollama] Sending request...');
    const response = await this.client.chat({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
    });
    console.log('[Ollama] Response received');

    let bslContent = response.message.content;
    console.log('[Ollama] Raw response length:', bslContent.length);

    // Extract YAML from markdown code blocks if present
    const yamlBlockMatch = bslContent.match(/```(?:yaml|yml)?\s*\n([\s\S]*?)\n```/);
    if (yamlBlockMatch) {
      console.log('[Ollama] Extracted YAML from code block');
      bslContent = yamlBlockMatch[1];
    } else {
      // Try to find YAML content starting with "name:" if no code block
      const yamlStartMatch = bslContent.match(/(name:\s*[\s\S]*)/);
      if (yamlStartMatch) {
        console.log('[Ollama] Extracted YAML starting from "name:"');
        bslContent = yamlStartMatch[1];
      }
    }

    bslContent = bslContent.trim();

    // Validate YAML structure
    try {
      yaml.load(bslContent);
      console.log('[Ollama] YAML validation passed');
    } catch (parseError) {
      console.error('[Ollama] YAML validation failed:', parseError);
      console.error('[Ollama] Content was:', bslContent.substring(0, 500));
      throw new Error('LLM generated invalid BSL');
    }

    return bslContent;
  }
}
