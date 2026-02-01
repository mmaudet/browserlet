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
    console.log('[Claude] Checking availability...');
    try {
      await this.rateLimiter.execute(async () => {
        await this.client.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        });
      });
      console.log('[Claude] Available: true');
      return true;
    } catch (error) {
      console.error('[Claude] Availability check failed:', error);
      return false;
    }
  }

  /**
   * Generate raw text response from a prompt
   * @param prompt - The prompt to send to the LLM
   * @returns Promise resolving to raw text response
   */
  async generate(prompt: string): Promise<string> {
    console.log('[Claude] generate called with prompt length:', prompt.length);

    const response = await this.rateLimiter.execute(async () => {
      return this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
    });

    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    return textBlock.text;
  }

  /**
   * Generate BSL script from captured actions using Claude
   * @param actions - Array of captured user actions
   * @returns Promise resolving to BSL YAML string
   * @throws Error if API call fails or generated BSL is invalid YAML
   */
  async generateBSL(actions: CapturedAction[]): Promise<string> {
    console.log('[Claude] generateBSL called with', actions.length, 'actions');
    console.log('[Claude] Using model:', this.model);

    const prompt = buildBSLPrompt(actions);
    console.log('[Claude] Prompt length:', prompt.length, 'chars');

    const response = await this.rateLimiter.execute(async () => {
      console.log('[Claude] Sending request to API...');
      return this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      });
    });
    console.log('[Claude] Response received');

    // Extract text content from response
    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    let bslContent = textBlock.text;
    console.log('[Claude] Raw response length:', bslContent.length);

    // Extract YAML from markdown code blocks if present
    const yamlBlockMatch = bslContent.match(/```(?:yaml|yml)?\s*\n([\s\S]*?)\n```/);
    if (yamlBlockMatch) {
      console.log('[Claude] Extracted YAML from code block');
      bslContent = yamlBlockMatch[1];
    } else {
      // Try to find YAML content starting with "name:" if no code block
      const yamlStartMatch = bslContent.match(/(name:\s*[\s\S]*)/);
      if (yamlStartMatch) {
        console.log('[Claude] Extracted YAML starting from "name:"');
        bslContent = yamlStartMatch[1];
      }
    }

    // Trim whitespace
    bslContent = bslContent.trim();

    // Validate YAML structure
    try {
      yaml.load(bslContent);
      console.log('[Claude] YAML validation passed');
    } catch (parseError) {
      console.error('[Claude] YAML validation failed:', parseError);
      console.error('[Claude] Content was:', bslContent.substring(0, 500));
      throw new Error('LLM generated invalid BSL');
    }

    return bslContent;
  }
}
