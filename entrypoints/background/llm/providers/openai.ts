/**
 * OpenAI-compatible API provider implementation
 * Works with any service implementing the OpenAI chat completions API format
 * (OpenAI, Azure OpenAI, OpenRouter, local LLMs with compatible APIs, etc.)
 */

import yaml from 'js-yaml';
import { RateLimiter } from '../rateLimiter';
import { buildBSLPrompt } from '../promptBuilder';
import type { LLMProvider } from './types';
import type { CapturedAction } from '../../../content/recording/types';

/**
 * OpenAI API response structure
 */
interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * OpenAI-compatible provider implementing LLMProvider interface
 *
 * Features:
 * - Works with any OpenAI-compatible chat completions endpoint
 * - Rate limiting with exponential backoff
 * - YAML validation on generated BSL
 * - Configurable endpoint and model
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai' as const;

  private endpoint: string;
  private apiKey: string;
  private model: string;
  private rateLimiter: RateLimiter;

  /**
   * Create a new OpenAI-compatible provider
   * @param endpoint - Chat completions endpoint URL
   * @param apiKey - API key for authentication
   * @param model - Model name to use (default: gpt-4o)
   */
  constructor(endpoint: string, apiKey: string, model?: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.model = model ?? 'gpt-4o';
    this.rateLimiter = new RateLimiter();
  }

  /**
   * Check if the OpenAI API is available
   * @returns Promise resolving to availability status
   */
  async isAvailable(): Promise<boolean> {
    console.log('[OpenAI] Checking availability at:', this.endpoint);
    try {
      const response = await this.rateLimiter.execute(async () => {
        return fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1,
          }),
        });
      });

      if (!response.ok) {
        console.error('[OpenAI] Availability check failed:', response.status, response.statusText);
        return false;
      }

      console.log('[OpenAI] Available: true');
      return true;
    } catch (error) {
      console.error('[OpenAI] Availability check failed:', error);
      return false;
    }
  }

  /**
   * Generate BSL script from captured actions using OpenAI-compatible API
   * @param actions - Array of captured user actions
   * @returns Promise resolving to BSL YAML string
   * @throws Error if API call fails or generated BSL is invalid YAML
   */
  async generateBSL(actions: CapturedAction[]): Promise<string> {
    console.log('[OpenAI] generateBSL called with', actions.length, 'actions');
    console.log('[OpenAI] Using endpoint:', this.endpoint);
    console.log('[OpenAI] Using model:', this.model);

    const prompt = buildBSLPrompt(actions);
    console.log('[OpenAI] Prompt length:', prompt.length, 'chars');

    const response = await this.rateLimiter.execute(async () => {
      console.log('[OpenAI] Sending request to API...');
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4096,
          temperature: 0.1, // Low temperature for consistent output
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI API error: ${res.status} ${res.statusText} - ${errorText}`);
      }

      return res.json() as Promise<OpenAIResponse>;
    });
    console.log('[OpenAI] Response received');

    // Extract text content from response
    const messageContent = response.choices[0]?.message?.content;
    if (!messageContent) {
      throw new Error('No content in OpenAI response');
    }

    let bslContent = messageContent;
    console.log('[OpenAI] Raw response length:', bslContent.length);

    // Extract YAML from markdown code blocks if present
    const yamlBlockMatch = bslContent.match(/```(?:yaml|yml)?\s*\n([\s\S]*?)\n```/);
    if (yamlBlockMatch) {
      console.log('[OpenAI] Extracted YAML from code block');
      bslContent = yamlBlockMatch[1];
    } else {
      // Try to find YAML content starting with "name:" if no code block
      const yamlStartMatch = bslContent.match(/(name:\s*[\s\S]*)/);
      if (yamlStartMatch) {
        console.log('[OpenAI] Extracted YAML starting from "name:"');
        bslContent = yamlStartMatch[1];
      }
    }

    // Trim whitespace
    bslContent = bslContent.trim();

    // Validate YAML structure
    try {
      yaml.load(bslContent);
      console.log('[OpenAI] YAML validation passed');
    } catch (parseError) {
      console.error('[OpenAI] YAML validation failed:', parseError);
      console.error('[OpenAI] Content was:', bslContent.substring(0, 500));
      throw new Error('LLM generated invalid BSL');
    }

    return bslContent;
  }
}
