/**
 * Claude API provider implementation
 * Uses @anthropic-ai/sdk with rate limiting for BSL generation
 */

import Anthropic from '@anthropic-ai/sdk';
import yaml from 'js-yaml';
import { RateLimiter } from '../rateLimiter';
import { buildBSLPrompt } from '../promptBuilder';
import type { LLMProvider } from './types';
import type { CapturedAction } from '../../../content/recording/types';

/**
 * Claude provider implementing LLMProvider interface
 *
 * Features:
 * - Uses official @anthropic-ai/sdk
 * - Rate limiting with exponential backoff for 429 errors
 * - YAML validation on generated BSL
 * - Configurable model selection
 */
export class ClaudeProvider implements LLMProvider {
  readonly name = 'claude' as const;

  private client: Anthropic;
  private rateLimiter: RateLimiter;
  private model: string;

  /**
   * Create a new Claude provider
   * @param apiKey - Anthropic API key
   * @param model - Model to use (default: claude-sonnet-4-5-20250929)
   */
  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true, // Required for browser extension context
    });
    this.rateLimiter = new RateLimiter();
    this.model = model ?? 'claude-sonnet-4-5-20250929';
  }

  /**
   * Check if the Claude API is available
   * Uses minimal tokens with Haiku for cost efficiency
   * @returns Promise resolving to availability status
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.rateLimiter.execute(async () => {
        await this.client.messages.create({
          model: 'claude-haiku-4-5-20250929',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        });
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate BSL script from captured actions using Claude
   * @param actions - Array of captured user actions
   * @returns Promise resolving to BSL YAML string
   * @throws Error if API call fails or generated BSL is invalid YAML
   */
  async generateBSL(actions: CapturedAction[]): Promise<string> {
    const prompt = buildBSLPrompt(actions);

    const response = await this.rateLimiter.execute(async () => {
      return this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
    });

    // Extract text content from response
    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    const bslContent = textBlock.text;

    // Validate YAML structure
    try {
      yaml.load(bslContent);
    } catch {
      throw new Error('LLM generated invalid BSL');
    }

    return bslContent;
  }
}
