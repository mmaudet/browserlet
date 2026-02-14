import { describe, it, expect, vi } from 'vitest';

import {
  validateHintSuggesterOutput,
  validateDisambiguatorOutput,
  validateConfidenceBoosterOutput,
  validateMicroPromptOutput,
  buildMicroPrompt,
  MICRO_PROMPT_BUDGETS,
} from '../../../entrypoints/background/llm/microPromptBuilder';
import type {
  MicroPromptInput,
  HintSuggesterInput,
  DisambiguatorInput,
  ConfidenceBoosterInput,
} from '../../../entrypoints/background/llm/microPromptBuilder';

// ---------------------------------------------------------------------------
// validateHintSuggesterOutput
// ---------------------------------------------------------------------------

describe('validateHintSuggesterOutput', () => {
  it('should accept valid output with string hints', () => {
    const result = validateHintSuggesterOutput({
      suggested_hints: [
        { type: 'role', value: 'button' },
        { type: 'text_contains', value: 'submit' },
      ],
      reasoning: 'Found button with submit text',
    });
    expect(result).not.toBeNull();
    expect(result!.suggested_hints).toHaveLength(2);
    expect(result!.reasoning).toBe('Found button with submit text');
  });

  it('should accept valid output with data_attribute object hint', () => {
    const result = validateHintSuggesterOutput({
      suggested_hints: [
        { type: 'data_attribute', value: { name: 'data-testid', value: 'btn' } },
      ],
      reasoning: 'Found by data-testid',
    });
    expect(result).not.toBeNull();
    expect(result!.suggested_hints).toHaveLength(1);
  });

  it('should accept data_attribute with string value', () => {
    const result = validateHintSuggesterOutput({
      suggested_hints: [
        { type: 'data_attribute', value: 'submit-button' },
      ],
      reasoning: 'simple string value',
    });
    expect(result).not.toBeNull();
  });

  it('should return null for non-object input', () => {
    expect(validateHintSuggesterOutput(null)).toBeNull();
    expect(validateHintSuggesterOutput(undefined)).toBeNull();
    expect(validateHintSuggesterOutput('string')).toBeNull();
    expect(validateHintSuggesterOutput(42)).toBeNull();
  });

  it('should return null when suggested_hints is missing', () => {
    expect(validateHintSuggesterOutput({ reasoning: 'no hints' })).toBeNull();
  });

  it('should return null when suggested_hints is not an array', () => {
    expect(validateHintSuggesterOutput({ suggested_hints: 'not-array', reasoning: '' })).toBeNull();
  });

  it('should return null for empty suggested_hints array', () => {
    expect(validateHintSuggesterOutput({ suggested_hints: [], reasoning: '' })).toBeNull();
  });

  it('should return null for too many hints (>5)', () => {
    const hints = Array.from({ length: 6 }, (_, i) => ({ type: 'role', value: `val${i}` }));
    expect(validateHintSuggesterOutput({ suggested_hints: hints, reasoning: '' })).toBeNull();
  });

  it('should return null for invalid hint type', () => {
    expect(validateHintSuggesterOutput({
      suggested_hints: [{ type: 'invalid_type', value: 'val' }],
      reasoning: '',
    })).toBeNull();
  });

  it('should return null for empty hint value string', () => {
    expect(validateHintSuggesterOutput({
      suggested_hints: [{ type: 'role', value: '' }],
      reasoning: '',
    })).toBeNull();
  });

  it('should return null for non-string hint value on non-data_attribute type', () => {
    expect(validateHintSuggesterOutput({
      suggested_hints: [{ type: 'role', value: 123 }],
      reasoning: '',
    })).toBeNull();
  });

  it('should return null for data_attribute with invalid object value', () => {
    expect(validateHintSuggesterOutput({
      suggested_hints: [{ type: 'data_attribute', value: { name: 123, value: 'x' } }],
      reasoning: '',
    })).toBeNull();
  });

  it('should return null for data_attribute with non-string non-object value', () => {
    expect(validateHintSuggesterOutput({
      suggested_hints: [{ type: 'data_attribute', value: 42 }],
      reasoning: '',
    })).toBeNull();
  });

  it('should default reasoning to empty string when not provided', () => {
    const result = validateHintSuggesterOutput({
      suggested_hints: [{ type: 'id', value: 'test' }],
    });
    expect(result).not.toBeNull();
    expect(result!.reasoning).toBe('');
  });

  it('should return null when hint is not an object', () => {
    expect(validateHintSuggesterOutput({
      suggested_hints: ['not-an-object'],
      reasoning: '',
    })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateDisambiguatorOutput
// ---------------------------------------------------------------------------

describe('validateDisambiguatorOutput', () => {
  it('should accept valid output', () => {
    const result = validateDisambiguatorOutput({
      selected_index: 0,
      confidence: 0.95,
      reasoning: 'First candidate matches best',
    });
    expect(result).not.toBeNull();
    expect(result!.selected_index).toBe(0);
    expect(result!.confidence).toBe(0.95);
  });

  it('should return null for non-object input', () => {
    expect(validateDisambiguatorOutput(null)).toBeNull();
    expect(validateDisambiguatorOutput(undefined)).toBeNull();
  });

  it('should return null for negative selected_index', () => {
    expect(validateDisambiguatorOutput({
      selected_index: -1, confidence: 0.9, reasoning: '',
    })).toBeNull();
  });

  it('should return null for non-integer selected_index', () => {
    expect(validateDisambiguatorOutput({
      selected_index: 1.5, confidence: 0.9, reasoning: '',
    })).toBeNull();
  });

  it('should return null for missing selected_index', () => {
    expect(validateDisambiguatorOutput({
      confidence: 0.9, reasoning: '',
    })).toBeNull();
  });

  it('should return null for confidence out of range (>1)', () => {
    expect(validateDisambiguatorOutput({
      selected_index: 0, confidence: 1.5, reasoning: '',
    })).toBeNull();
  });

  it('should return null for confidence out of range (<0)', () => {
    expect(validateDisambiguatorOutput({
      selected_index: 0, confidence: -0.1, reasoning: '',
    })).toBeNull();
  });

  it('should return null for missing confidence', () => {
    expect(validateDisambiguatorOutput({
      selected_index: 0, reasoning: '',
    })).toBeNull();
  });

  it('should accept boundary values: confidence 0 and 1', () => {
    expect(validateDisambiguatorOutput({
      selected_index: 0, confidence: 0, reasoning: '',
    })).not.toBeNull();
    expect(validateDisambiguatorOutput({
      selected_index: 0, confidence: 1, reasoning: '',
    })).not.toBeNull();
  });

  it('should default reasoning to empty string when not provided', () => {
    const result = validateDisambiguatorOutput({
      selected_index: 0, confidence: 0.8,
    });
    expect(result).not.toBeNull();
    expect(result!.reasoning).toBe('');
  });
});

// ---------------------------------------------------------------------------
// validateConfidenceBoosterOutput
// ---------------------------------------------------------------------------

describe('validateConfidenceBoosterOutput', () => {
  it('should accept valid output with is_correct=true', () => {
    const result = validateConfidenceBoosterOutput({
      is_correct: true,
      reasoning: 'Element matches expected target',
    });
    expect(result).not.toBeNull();
    expect(result!.is_correct).toBe(true);
  });

  it('should accept valid output with is_correct=false', () => {
    const result = validateConfidenceBoosterOutput({
      is_correct: false,
      reasoning: 'Wrong element',
    });
    expect(result).not.toBeNull();
    expect(result!.is_correct).toBe(false);
  });

  it('should return null for non-object input', () => {
    expect(validateConfidenceBoosterOutput(null)).toBeNull();
    expect(validateConfidenceBoosterOutput(undefined)).toBeNull();
  });

  it('should return null when is_correct is missing', () => {
    expect(validateConfidenceBoosterOutput({ reasoning: 'no bool' })).toBeNull();
  });

  it('should return null when is_correct is not boolean', () => {
    expect(validateConfidenceBoosterOutput({
      is_correct: 'true', reasoning: '',
    })).toBeNull();
    expect(validateConfidenceBoosterOutput({
      is_correct: 1, reasoning: '',
    })).toBeNull();
  });

  it('should default reasoning to empty string when not provided', () => {
    const result = validateConfidenceBoosterOutput({ is_correct: true });
    expect(result).not.toBeNull();
    expect(result!.reasoning).toBe('');
  });
});

// ---------------------------------------------------------------------------
// validateMicroPromptOutput (unified dispatcher)
// ---------------------------------------------------------------------------

describe('validateMicroPromptOutput', () => {
  it('should dispatch to hint_suggester validator', () => {
    const result = validateMicroPromptOutput('hint_suggester', {
      suggested_hints: [{ type: 'role', value: 'button' }],
      reasoning: 'test',
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe('hint_suggester');
  });

  it('should dispatch to disambiguator validator', () => {
    const result = validateMicroPromptOutput('disambiguator', {
      selected_index: 0, confidence: 0.9, reasoning: 'test',
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe('disambiguator');
  });

  it('should dispatch to confidence_booster validator', () => {
    const result = validateMicroPromptOutput('confidence_booster', {
      is_correct: true, reasoning: 'test',
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe('confidence_booster');
  });

  it('should return null for unknown type', () => {
    const result = validateMicroPromptOutput('unknown_type' as any, {});
    expect(result).toBeNull();
  });

  it('should return null when validator fails', () => {
    const result = validateMicroPromptOutput('hint_suggester', { bad: 'data' });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildMicroPrompt
// ---------------------------------------------------------------------------

describe('buildMicroPrompt', () => {
  it('should build a non-empty hint_suggester prompt', () => {
    const input: MicroPromptInput = {
      type: 'hint_suggester',
      data: {
        original_hints: [{ type: 'id', value: 'email' }],
        dom_excerpt: '<input type="email">',
        page_url: 'https://example.com',
        action_type: 'click',
      },
    };
    const prompt = buildMicroPrompt(input);
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('No elements matched');
  });

  it('should build a non-empty disambiguator prompt', () => {
    const input: MicroPromptInput = {
      type: 'disambiguator',
      data: {
        candidates: [
          { index: 0, tag: 'input', text: 'email', attributes: { type: 'email' }, structural_context: 'billing' },
          { index: 1, tag: 'input', text: 'email', attributes: { type: 'email' }, structural_context: 'shipping' },
        ],
        original_hints: [{ type: 'type', value: 'email' }],
        action_type: 'type',
        action_value: 'test@example.com',
      },
    };
    const prompt = buildMicroPrompt(input);
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('Multiple elements matched');
  });

  it('should build a non-empty confidence_booster prompt', () => {
    const input: MicroPromptInput = {
      type: 'confidence_booster',
      data: {
        candidate: {
          tag: 'input',
          text: '',
          attributes: { type: 'email', name: 'email' },
          structural_context: 'billing form',
        },
        original_hints: [{ type: 'name', value: 'email' }],
        matched_hints: ['name:email'],
        failed_hints: ['id:user-email'],
        confidence: 0.55,
      },
    };
    const prompt = buildMicroPrompt(input);
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('confidence');
  });

  it('should truncate DOM excerpt to 300 chars for hint_suggester', () => {
    const longExcerpt = 'x'.repeat(1000);
    const input: MicroPromptInput = {
      type: 'hint_suggester',
      data: {
        original_hints: [{ type: 'id', value: 'test' }],
        dom_excerpt: longExcerpt,
        page_url: 'https://example.com',
        action_type: 'click',
      },
    };
    const prompt = buildMicroPrompt(input);
    // The prompt should not contain the full 1000-char excerpt
    expect(prompt).not.toContain(longExcerpt);
  });

  it('should warn when prompt exceeds token budget', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Create a very large input to exceed budget
    const largeHints = Array.from({ length: 50 }, (_, i) => ({
      type: 'text_contains' as const,
      value: 'very-long-hint-value-' + 'x'.repeat(20) + '-' + i,
    }));

    const input: MicroPromptInput = {
      type: 'hint_suggester',
      data: {
        original_hints: largeHints,
        dom_excerpt: 'x'.repeat(500),
        page_url: 'https://example.com/very/long/url/' + 'path/'.repeat(50),
        action_type: 'click',
      },
    };

    buildMicroPrompt(input);

    const budgetWarning = warnSpy.mock.calls.find(
      call => typeof call[0] === 'string' && call[0].includes('exceeds input budget')
    );
    expect(budgetWarning).toBeDefined();

    warnSpy.mockRestore();
  });

  it('should limit disambiguator candidates to max 5', () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      index: i,
      tag: 'input',
      text: `candidate ${i}`,
      attributes: { type: 'text' },
      structural_context: `section ${i}`,
    }));

    const input: MicroPromptInput = {
      type: 'disambiguator',
      data: {
        candidates,
        original_hints: [{ type: 'type', value: 'text' }],
        action_type: 'click',
      },
    };

    const prompt = buildMicroPrompt(input);
    // Should only contain candidates 0-4, not 5-9
    expect(prompt).toContain('[0]');
    expect(prompt).toContain('[4]');
    expect(prompt).not.toContain('[5]');
  });
});
