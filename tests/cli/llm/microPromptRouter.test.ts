/**
 * MicroPromptRouter unit tests
 *
 * Tests the CLI micro-prompt routing logic including:
 * - Three-tier JSON extraction (direct, markdown, regex)
 * - Error code handling (UNKNOWN_PROMPT_TYPE, LLM_NOT_AVAILABLE, etc.)
 * - Validation against schemas
 * - Success path with token estimation
 *
 * Uses mock LLM providers to control responses, no network calls.
 *
 * Phase 28 - Plan 28-03
 */

import { describe, it, expect } from 'vitest';
import { routeMicroPrompt } from '../../../packages/cli/src/llm/microPromptRouter.js';
import type { LLMProvider } from '../../../packages/cli/src/llm/providers/types.js';
import type { MicroPromptRequest } from '../../../packages/cli/src/llm/microPromptRouter.js';

// ---------------------------------------------------------------------------
// Mock provider implementation
// ---------------------------------------------------------------------------

class MockProvider implements LLMProvider {
  constructor(
    private mockResponse: string | Error,
    private available: boolean = true
  ) {}

  name = 'claude' as const;

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async generate(_prompt: string): Promise<string> {
    if (this.mockResponse instanceof Error) {
      throw this.mockResponse;
    }
    return this.mockResponse;
  }
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('MicroPromptRouter', () => {
  describe('extractJSON helper (via router)', () => {
    it('parses direct JSON response', async () => {
      const directJson = JSON.stringify({
        suggested_hints: [
          { type: 'text_contains', value: 'Submit' }
        ],
        reasoning: 'Test reasoning'
      });

      const provider = new MockProvider(directJson);
      const request: MicroPromptRequest = {
        promptType: 'hint_suggester',
        input: {
          type: 'hint_suggester',
          data: {
            original_hints: [],
            dom_excerpt: '<button>Submit</button>',
            page_url: 'https://example.com',
            action_type: 'click'
          }
        }
      };

      const result = await routeMicroPrompt(provider, request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.type).toBe('hint_suggester');
        expect(result.output.data).toHaveProperty('suggested_hints');
        expect(Array.isArray(result.output.data.suggested_hints)).toBe(true);
      }
    });

    it('extracts JSON from markdown code block', async () => {
      const markdownJson = '```json\n' + JSON.stringify({
        suggested_hints: [
          { type: 'role', value: 'button' }
        ],
        reasoning: 'Markdown test'
      }) + '\n```';

      const provider = new MockProvider(markdownJson);
      const request: MicroPromptRequest = {
        promptType: 'hint_suggester',
        input: {
          type: 'hint_suggester',
          data: {
            original_hints: [],
            dom_excerpt: '<button>Click Me</button>',
            page_url: 'https://example.com',
            action_type: 'click'
          }
        }
      };

      const result = await routeMicroPrompt(provider, request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.type).toBe('hint_suggester');
        expect(result.output.data).toHaveProperty('suggested_hints');
        expect(Array.isArray(result.output.data.suggested_hints)).toBe(true);
      }
    });

    it('extracts JSON from regex pattern', async () => {
      const textWithJson = 'Here is the result: ' + JSON.stringify({
        suggested_hints: [
          { type: 'id', value: 'submit-btn' }
        ],
        reasoning: 'Regex test'
      }) + ' as requested';

      const provider = new MockProvider(textWithJson);
      const request: MicroPromptRequest = {
        promptType: 'hint_suggester',
        input: {
          type: 'hint_suggester',
          data: {
            original_hints: [],
            dom_excerpt: '<button id="submit-btn">Submit</button>',
            page_url: 'https://example.com',
            action_type: 'click'
          }
        }
      };

      const result = await routeMicroPrompt(provider, request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.type).toBe('hint_suggester');
        expect(result.output.data).toHaveProperty('suggested_hints');
        expect(Array.isArray(result.output.data.suggested_hints)).toBe(true);
      }
    });

    it('returns INVALID_RESPONSE for non-JSON', async () => {
      const provider = new MockProvider("I don't know how to help with that");
      const request: MicroPromptRequest = {
        promptType: 'hint_suggester',
        input: {
          type: 'hint_suggester',
          data: {
            original_hints: [],
            dom_excerpt: '<button>Unknown</button>',
            page_url: 'https://example.com',
            action_type: 'click'
          }
        }
      };

      const result = await routeMicroPrompt(provider, request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('INVALID_RESPONSE');
        expect(result.error).toContain('Could not parse JSON');
      }
    });
  });

  describe('routeMicroPrompt', () => {
    it('returns UNKNOWN_PROMPT_TYPE for invalid type', async () => {
      const provider = new MockProvider('{}');
      const request = {
        promptType: 'invalid_type' as any,
        input: {
          type: 'hint_suggester' as const,
          data: {
            original_hints: [],
            dom_excerpt: '',
            page_url: '',
            action_type: 'click'
          }
        }
      };

      const result = await routeMicroPrompt(provider, request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('UNKNOWN_PROMPT_TYPE');
        expect(result.error).toContain('Unknown prompt type');
      }
    });

    it('returns LLM_NOT_AVAILABLE when provider.isAvailable() false', async () => {
      const provider = new MockProvider('{}', false); // available=false
      const request: MicroPromptRequest = {
        promptType: 'hint_suggester',
        input: {
          type: 'hint_suggester',
          data: {
            original_hints: [],
            dom_excerpt: '',
            page_url: '',
            action_type: 'click'
          }
        }
      };

      const result = await routeMicroPrompt(provider, request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('LLM_NOT_AVAILABLE');
        expect(result.error).toContain('not available');
      }
    });

    it('returns VALIDATION_FAILED for schema mismatch', async () => {
      // Valid JSON but wrong structure (missing required fields)
      const invalidStructure = JSON.stringify({
        wrong_field: 'test'
      });

      const provider = new MockProvider(invalidStructure);
      const request: MicroPromptRequest = {
        promptType: 'hint_suggester',
        input: {
          type: 'hint_suggester',
          data: {
            original_hints: [],
            dom_excerpt: '<button>Test</button>',
            page_url: 'https://example.com',
            action_type: 'click'
          }
        }
      };

      const result = await routeMicroPrompt(provider, request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('VALIDATION_FAILED');
        expect(result.error).toContain('validation failed');
      }
    });

    it('returns success with tokenEstimate for valid response', async () => {
      const validResponse = JSON.stringify({
        suggested_hints: [
          { type: 'text_contains', value: 'Login' },
          { type: 'role', value: 'button' }
        ],
        reasoning: 'The button has "Login" text and role=button'
      });

      const provider = new MockProvider(validResponse);
      const request: MicroPromptRequest = {
        promptType: 'hint_suggester',
        input: {
          type: 'hint_suggester',
          data: {
            original_hints: [
              { type: 'text_contains', value: 'Sign In' }
            ],
            dom_excerpt: '<button>Login</button>',
            page_url: 'https://example.com/auth',
            action_type: 'click'
          }
        }
      };

      const result = await routeMicroPrompt(provider, request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.type).toBe('hint_suggester');
        expect(result.output.data).toHaveProperty('suggested_hints');
        expect(Array.isArray(result.output.data.suggested_hints)).toBe(true);
        expect(result.tokenEstimate).toBeGreaterThan(0);
        expect(typeof result.tokenEstimate).toBe('number');
      }
    });

    it('handles LLM_GENERATION_FAILED when provider.generate() throws', async () => {
      const error = new Error('Network timeout');
      const provider = new MockProvider(error);
      const request: MicroPromptRequest = {
        promptType: 'disambiguator',
        input: {
          type: 'disambiguator',
          data: {
            candidates: [
              {
                index: 0,
                tag: 'button',
                text: 'Submit',
                attributes: {},
                structural_context: 'inside form'
              }
            ],
            original_hints: [],
            action_type: 'click'
          }
        }
      };

      const result = await routeMicroPrompt(provider, request);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe('LLM_GENERATION_FAILED');
        expect(result.error).toContain('Network timeout');
      }
    });
  });
});
