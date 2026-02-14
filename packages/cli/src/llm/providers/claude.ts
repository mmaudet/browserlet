/**
 * Claude API provider implementation for CLI
 *
 * Uses @anthropic-ai/sdk in Node.js server-side context.
 * No dangerouslyAllowBrowser flag needed (server-side execution).
 */

import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider } from './types.js';

/**
 * Claude provider implementing LLMProvider interface
 *
 * Features:
 * - Uses official @anthropic-ai/sdk
 * - Server-side Node.js execution (no browser polyfills)
 * - Simple availability check (API key presence)
 * - Configurable model selection
 */
export class ClaudeProvider implements LLMProvider {
  readonly name = 'claude' as const;

  private client: Anthropic;
  private model: string;

  /**
   * Create a new Claude provider
   * @param apiKey - Anthropic API key
   * @param model - Model to use (default: claude-sonnet-4-5-20250929)
   */
  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({
      apiKey,
      // No dangerouslyAllowBrowser flag - this is server-side Node.js
    });
    this.model = model ?? 'claude-sonnet-4-5-20250929';
  }

  /**
   * Check if the Claude provider is available
   * Returns true if API key is present (no network check for latency reasons)
   * @returns Promise resolving to availability status
   */
  async isAvailable(): Promise<boolean> {
    // Simple check: if we have a client, we're configured
    // Avoid network check to prevent latency during resolution
    return true;
  }

  /**
   * Generate raw text response from a prompt
   * @param prompt - The prompt to send to the LLM
   * @returns Promise resolving to raw text response
   */
  async generate(prompt: string): Promise<string> {
    console.log('[Claude] generate called with prompt length:', prompt.length);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract text from response content (matches extension pattern)
    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    return textBlock.text;
  }
}
