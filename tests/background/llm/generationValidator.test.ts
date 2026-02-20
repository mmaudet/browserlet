import { describe, it, expect } from 'vitest';

import {
  validateGeneratedBSL,
  type DOMSnapshot,
  type GenerationValidationReport,
} from '@/entrypoints/background/llm/generationValidator';
import type { ParsedScript, BSLStep } from '@browserlet/core/types';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeScript(steps: BSLStep[]): ParsedScript {
  return { name: 'test', steps };
}

function makeSnapshot(overrides: Partial<DOMSnapshot> = {}): DOMSnapshot {
  return {
    url: 'https://example.com',
    observedValues: {},
    observedDataAttributes: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateGeneratedBSL -- null snapshot', () => {
  it('returns validated=false when snapshot is null', () => {
    const script = makeScript([]);
    const report = validateGeneratedBSL(script, null);

    expect(report.validated).toBe(false);
    expect(report.hasIssues).toBe(false);
    expect(report.stepResults).toEqual([]);
    expect(report.invalidStepCount).toBe(0);
    expect(report.totalStepsChecked).toBe(0);
  });
});

describe('validateGeneratedBSL -- clean match', () => {
  it('valid: step with role=textbox, snapshot observes textbox', () => {
    const script = makeScript([
      {
        action: 'click',
        target: {
          hints: [{ type: 'role', value: 'textbox' }],
        },
      },
    ]);
    const snapshot = makeSnapshot({
      observedValues: { role: ['textbox', 'button'] },
    });

    const report = validateGeneratedBSL(script, snapshot);

    expect(report.validated).toBe(true);
    expect(report.stepResults).toHaveLength(1);
    expect(report.stepResults[0]!.valid).toBe(true);
    expect(report.stepResults[0]!.mismatches).toHaveLength(0);
    expect(report.hasIssues).toBe(false);
  });

  it('valid: step with name=email, snapshot observes email', () => {
    const script = makeScript([
      {
        action: 'type',
        target: {
          hints: [{ type: 'name', value: 'email' }],
        },
        value: 'test@example.com',
      },
    ]);
    const snapshot = makeSnapshot({
      observedValues: { name: ['email', 'password'] },
    });

    const report = validateGeneratedBSL(script, snapshot);

    expect(report.validated).toBe(true);
    expect(report.stepResults[0]!.valid).toBe(true);
    expect(report.stepResults[0]!.mismatches).toHaveLength(0);
  });

  it('skips navigate steps', () => {
    const script = makeScript([
      { action: 'navigate', value: 'https://example.com' },
      {
        action: 'click',
        target: {
          hints: [{ type: 'role', value: 'button' }],
        },
      },
    ]);
    const snapshot = makeSnapshot({
      observedValues: { role: ['button'] },
    });

    const report = validateGeneratedBSL(script, snapshot);

    // Only the click step should appear in results
    expect(report.stepResults).toHaveLength(1);
    expect(report.stepResults[0]!.action).toBe('click');
    expect(report.totalStepsChecked).toBe(1);
  });

  it('skips screenshot steps', () => {
    const script = makeScript([
      { action: 'screenshot' },
      {
        action: 'click',
        target: {
          hints: [{ type: 'role', value: 'link' }],
        },
      },
    ]);
    const snapshot = makeSnapshot({
      observedValues: { role: ['link'] },
    });

    const report = validateGeneratedBSL(script, snapshot);

    expect(report.stepResults).toHaveLength(1);
    expect(report.stepResults[0]!.action).toBe('click');
    expect(report.totalStepsChecked).toBe(1);
  });
});

describe('validateGeneratedBSL -- mismatches', () => {
  it('mismatch: generated role=button but snapshot does not contain button for role', () => {
    const script = makeScript([
      {
        action: 'click',
        target: {
          hints: [{ type: 'role', value: 'button' }],
        },
      },
    ]);
    const snapshot = makeSnapshot({
      observedValues: { role: ['textbox', 'link'] },
    });

    const report = validateGeneratedBSL(script, snapshot);

    expect(report.stepResults[0]!.valid).toBe(false);
    expect(report.stepResults[0]!.mismatches).toHaveLength(1);
    expect(report.stepResults[0]!.mismatches[0]).toEqual({
      hintType: 'role',
      hintValue: 'button',
      reason: 'value_not_in_snapshot',
    });
    expect(report.hasIssues).toBe(true);
    expect(report.invalidStepCount).toBe(1);
  });

  it('mismatch: generated text_contains=Submit but snapshot has only Cancel', () => {
    const script = makeScript([
      {
        action: 'click',
        target: {
          hints: [{ type: 'text_contains', value: 'Submit' }],
        },
      },
    ]);
    const snapshot = makeSnapshot({
      observedValues: { text_contains: ['Cancel', 'Back'] },
    });

    const report = validateGeneratedBSL(script, snapshot);

    expect(report.stepResults[0]!.valid).toBe(false);
    expect(report.stepResults[0]!.mismatches[0]).toEqual({
      hintType: 'text_contains',
      hintValue: 'Submit',
      reason: 'value_not_in_snapshot',
    });
  });

  it('valid when step has no target (navigate/screenshot)', () => {
    const script = makeScript([
      { action: 'navigate', value: 'https://example.com' },
      { action: 'screenshot' },
    ]);
    const snapshot = makeSnapshot();

    const report = validateGeneratedBSL(script, snapshot);

    expect(report.totalStepsChecked).toBe(0);
    expect(report.stepResults).toHaveLength(0);
    expect(report.hasIssues).toBe(false);
  });
});

describe('validateGeneratedBSL -- data_attribute', () => {
  it('valid: data_attribute matches snapshot observedDataAttributes', () => {
    const script = makeScript([
      {
        action: 'click',
        target: {
          hints: [
            {
              type: 'data_attribute',
              value: { name: 'data-testid', value: 'submit-btn' },
            },
          ],
        },
      },
    ]);
    const snapshot = makeSnapshot({
      observedDataAttributes: [
        { attrName: 'data-testid', attrValue: 'submit-btn' },
        { attrName: 'data-testid', attrValue: 'cancel-btn' },
      ],
    });

    const report = validateGeneratedBSL(script, snapshot);

    expect(report.stepResults[0]!.valid).toBe(true);
    expect(report.stepResults[0]!.mismatches).toHaveLength(0);
  });

  it('mismatch: data_attribute value not in snapshot', () => {
    const script = makeScript([
      {
        action: 'click',
        target: {
          hints: [
            {
              type: 'data_attribute',
              value: { name: 'data-testid', value: 'missing-btn' },
            },
          ],
        },
      },
    ]);
    const snapshot = makeSnapshot({
      observedDataAttributes: [],
    });

    const report = validateGeneratedBSL(script, snapshot);

    expect(report.stepResults[0]!.valid).toBe(false);
    expect(report.stepResults[0]!.mismatches).toHaveLength(1);
    expect(report.stepResults[0]!.mismatches[0]!.reason).toBe(
      'value_not_in_snapshot',
    );
  });

  it('valid: data_attribute plain string matches observedDataAttributes by attrValue', () => {
    const script = makeScript([
      {
        action: 'click',
        target: {
          hints: [
            {
              type: 'data_attribute',
              value: 'submit-btn',
            },
          ],
        },
      },
    ]);
    const snapshot = makeSnapshot({
      observedDataAttributes: [
        { attrName: 'data-testid', attrValue: 'submit-btn' },
      ],
    });

    const report = validateGeneratedBSL(script, snapshot);

    expect(report.stepResults[0]!.valid).toBe(true);
  });
});

describe('validateGeneratedBSL -- report shape', () => {
  it('invalidStepCount equals count of steps with mismatches', () => {
    const script = makeScript([
      {
        action: 'click',
        target: {
          hints: [{ type: 'role', value: 'button' }],
        },
      },
      {
        action: 'type',
        target: {
          hints: [{ type: 'name', value: 'username' }],
        },
        value: 'test',
      },
    ]);
    const snapshot = makeSnapshot({
      observedValues: {
        role: ['textbox'], // button not here -> mismatch
        name: ['email'], // username not here -> mismatch
      },
    });

    const report = validateGeneratedBSL(script, snapshot);

    expect(report.invalidStepCount).toBe(2);
    expect(report.stepResults).toHaveLength(2);
    expect(report.stepResults[0]!.valid).toBe(false);
    expect(report.stepResults[1]!.valid).toBe(false);
  });

  it('hasIssues is true when invalidStepCount > 0', () => {
    const script = makeScript([
      {
        action: 'click',
        target: {
          hints: [{ type: 'role', value: 'button' }],
        },
      },
    ]);
    const snapshot = makeSnapshot({
      observedValues: { role: ['link'] },
    });

    const report = validateGeneratedBSL(script, snapshot);

    expect(report.hasIssues).toBe(true);
    expect(report.invalidStepCount).toBe(1);
  });

  it('hasIssues is false when all steps valid', () => {
    const script = makeScript([
      {
        action: 'click',
        target: {
          hints: [{ type: 'role', value: 'button' }],
        },
      },
    ]);
    const snapshot = makeSnapshot({
      observedValues: { role: ['button'] },
    });

    const report = validateGeneratedBSL(script, snapshot);

    expect(report.hasIssues).toBe(false);
    expect(report.invalidStepCount).toBe(0);
  });

  it('totalStepsChecked excludes navigate and screenshot', () => {
    const script = makeScript([
      { action: 'navigate', value: 'https://example.com' },
      {
        action: 'click',
        target: {
          hints: [{ type: 'role', value: 'button' }],
        },
      },
      { action: 'screenshot' },
      {
        action: 'type',
        target: {
          hints: [{ type: 'name', value: 'email' }],
        },
        value: 'test@example.com',
      },
    ]);
    const snapshot = makeSnapshot({
      observedValues: {
        role: ['button'],
        name: ['email'],
      },
    });

    const report = validateGeneratedBSL(script, snapshot);

    // Only click and type should be checked (navigate + screenshot skipped)
    expect(report.totalStepsChecked).toBe(2);
    expect(report.stepResults).toHaveLength(2);
  });
});
