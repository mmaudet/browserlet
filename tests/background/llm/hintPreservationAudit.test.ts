import { describe, it, expect, vi } from 'vitest';

import {
  auditHintPreservation,
  type HintPreservationReport,
} from '@/entrypoints/background/llm/hintPreservationAudit';
import { sortHintsByWeight } from '@/entrypoints/background/llm/promptBuilder';
import type { ParsedScript, BSLStep } from '@browserlet/core/types';
import type { SemanticHint } from '@browserlet/core/types';
import type { CapturedAction } from '@/entrypoints/content/recording/types';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeAction(
  hints: SemanticHint[],
  type: CapturedAction['type'] = 'click',
): CapturedAction {
  return {
    type,
    timestamp: 0,
    url: 'https://example.com',
    hints,
    isIframe: false,
  };
}

function makeStep(hints: SemanticHint[], action: BSLStep['action'] = 'click'): BSLStep {
  return {
    action,
    target: { hints },
  };
}

function makeScript(steps: BSLStep[]): ParsedScript {
  return { name: 'test', steps };
}

// ---------------------------------------------------------------------------
// auditHintPreservation
// ---------------------------------------------------------------------------

describe('auditHintPreservation', () => {
  it('no loss when all high-weight hints are present in generated BSL', () => {
    const actions = [
      makeAction([
        { type: 'role', value: 'button' },
        { type: 'name', value: 'submit' },
        { type: 'type', value: 'submit' },
      ]),
    ];
    const script = makeScript([
      makeStep([
        { type: 'role', value: 'button' },
        { type: 'name', value: 'submit' },
        { type: 'type', value: 'submit' },
      ]),
    ]);

    const report = auditHintPreservation(actions, script);

    expect(report.hasLoss).toBe(false);
    expect(report.lossCount).toBe(0);
    expect(report.losses).toHaveLength(0);
    expect(report.auditedSteps).toBe(1);
  });

  it('detects loss when role hint is missing from generated step', () => {
    const actions = [
      makeAction([
        { type: 'role', value: 'button' },
        { type: 'name', value: 'submit' },
      ]),
    ];
    const script = makeScript([
      makeStep([
        { type: 'name', value: 'submit' },
        // role hint missing
      ]),
    ]);

    const report = auditHintPreservation(actions, script);

    expect(report.hasLoss).toBe(true);
    expect(report.lossCount).toBe(1);
    expect(report.losses[0]!.hintType).toBe('role');
    expect(report.losses[0]!.hintValue).toBe('button');
    expect(report.losses[0]!.weight).toBe(1.0);
  });

  it('detects loss when associated_label hint is missing', () => {
    const actions = [
      makeAction([
        { type: 'role', value: 'textbox' },
        { type: 'associated_label', value: 'Email Address' },
      ]),
    ];
    const script = makeScript([
      makeStep([
        { type: 'role', value: 'textbox' },
        // associated_label missing
      ]),
    ]);

    const report = auditHintPreservation(actions, script);

    expect(report.hasLoss).toBe(true);
    expect(report.losses).toHaveLength(1);
    expect(report.losses[0]!.hintType).toBe('associated_label');
    expect(report.losses[0]!.weight).toBe(0.7);
  });

  it('ignores low-weight hints (class_contains weight 0.5)', () => {
    const actions = [
      makeAction([
        { type: 'role', value: 'button' },
        { type: 'class_contains', value: 'btn-primary' },
      ]),
    ];
    const script = makeScript([
      makeStep([
        { type: 'role', value: 'button' },
        // class_contains omitted — but it's low-weight, should not be reported
      ]),
    ]);

    const report = auditHintPreservation(actions, script);

    expect(report.hasLoss).toBe(false);
    expect(report.lossCount).toBe(0);
  });

  it('skips navigate actions and navigate steps', () => {
    const actions = [
      makeAction([], 'navigate'), // navigate action (no hints)
      makeAction([
        { type: 'role', value: 'button' },
      ]),
    ];
    const script = makeScript([
      { action: 'navigate', value: 'https://example.com' }, // navigate step
      makeStep([
        { type: 'role', value: 'button' },
      ]),
    ]);

    const report = auditHintPreservation(actions, script);

    // navigate should be excluded; only the click action/step pair is audited
    expect(report.auditedSteps).toBe(1);
    expect(report.hasLoss).toBe(false);
  });

  it('skips screenshot steps', () => {
    const actions = [
      makeAction([
        { type: 'role', value: 'button' },
      ]),
    ];
    const script = makeScript([
      { action: 'screenshot' }, // screenshot step (no hints)
      makeStep([
        { type: 'role', value: 'button' },
      ]),
    ]);

    // The screenshot step is filtered out from steps side.
    // Actions: 1 click. Steps after filter: 1 click. Pair: click<->click.
    const report = auditHintPreservation(actions, script);

    expect(report.auditedSteps).toBe(1);
    expect(report.hasLoss).toBe(false);
  });

  it('handles count mismatch gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const actions = [
      makeAction([{ type: 'role', value: 'button' }]),
      makeAction([{ type: 'role', value: 'textbox' }]),
      makeAction([{ type: 'role', value: 'link' }]),
    ];
    const script = makeScript([
      makeStep([{ type: 'role', value: 'button' }]),
      makeStep([{ type: 'role', value: 'textbox' }]),
      // Third step missing
    ]);

    const report = auditHintPreservation(actions, script);

    // Should pair up to 2 (shorter length) with no error
    expect(report.auditedSteps).toBe(2);
    expect(report.hasLoss).toBe(false);

    // Should have logged a warning
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Action/step count mismatch'),
    );

    warnSpy.mockRestore();
  });

  it('data_attribute loss detected by name+value match', () => {
    const actions = [
      makeAction([
        { type: 'data_attribute', value: { name: 'data-testid', value: 'submit' } },
      ]),
    ];
    const script = makeScript([
      makeStep([
        // data_attribute missing
        { type: 'role', value: 'button' },
      ]),
    ]);

    const report = auditHintPreservation(actions, script);

    expect(report.hasLoss).toBe(true);
    expect(report.losses[0]!.hintType).toBe('data_attribute');
    expect(report.losses[0]!.hintValue).toEqual({ name: 'data-testid', value: 'submit' });
    expect(report.losses[0]!.weight).toBe(1.0);
  });

  it('data_attribute not reported as lost when value matches', () => {
    const actions = [
      makeAction([
        { type: 'data_attribute', value: { name: 'data-testid', value: 'submit' } },
      ]),
    ];
    const script = makeScript([
      makeStep([
        { type: 'data_attribute', value: { name: 'data-testid', value: 'submit' } },
      ]),
    ]);

    const report = auditHintPreservation(actions, script);

    expect(report.hasLoss).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sortHintsByWeight
// ---------------------------------------------------------------------------

describe('sortHintsByWeight', () => {
  it('sorts hints descending by weight', () => {
    const input: SemanticHint[] = [
      { type: 'class_contains', value: 'btn' },    // 0.5
      { type: 'role', value: 'button' },            // 1.0
      { type: 'data_attribute', value: { name: 'data-testid', value: 'x' } }, // 1.0
      { type: 'near_label', value: 'Submit' },      // 0.6
    ];

    const sorted = sortHintsByWeight(input);

    // data_attribute (1.0) and role (1.0) first, then near_label (0.6), then class_contains (0.5)
    expect(sorted[0]!.type).toBe('role');
    expect(sorted[1]!.type).toBe('data_attribute');
    expect(sorted[2]!.type).toBe('near_label');
    expect(sorted[3]!.type).toBe('class_contains');
  });

  it('does not mutate original array', () => {
    const input: SemanticHint[] = [
      { type: 'class_contains', value: 'btn' },
      { type: 'role', value: 'button' },
    ];
    const original = [...input];

    sortHintsByWeight(input);

    expect(input).toEqual(original);
  });

  it('handles empty array', () => {
    const sorted = sortHintsByWeight([]);
    expect(sorted).toEqual([]);
  });

  it('stable sort for equal-weight hints', () => {
    const input: SemanticHint[] = [
      { type: 'role', value: 'button' },   // 1.0
      { type: 'role', value: 'textbox' },  // 1.0
    ];

    const sorted = sortHintsByWeight(input);

    // Both weight 1.0 — should maintain relative order
    expect(sorted[0]!.value).toBe('button');
    expect(sorted[1]!.value).toBe('textbox');
  });
});
