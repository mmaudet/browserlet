import { describe, it, expect } from 'vitest';
import { suggestFix } from '../../../packages/cli/src/diagnostic/suggester.js';
import type { FailureDiagnostic, CandidateScoringRow, DiagnosticHintScore } from '@browserlet/core/types';

/** Minimal FailureDiagnostic factory for testing */
function makeDiagnostic(overrides: Partial<FailureDiagnostic> = {}): FailureDiagnostic {
  return {
    stepId: 'click-submit',
    searchedHints: [
      { type: 'role', value: 'button' },
      { type: 'text_contains', value: 'Submit' },
    ],
    failedAtStage: 2,
    confidenceThreshold: 0.70,
    bestCandidateScore: null,
    confidenceGap: null,
    topCandidates: [],
    pageUrl: 'https://example.com/form',
    timestamp: '2026-02-20T08:00:00Z',
    ...overrides,
  };
}

/** Build a minimal CandidateScoringRow */
function makeCandidate(
  adjustedConfidence: number,
  hintScores: DiagnosticHintScore[],
  tag: string = 'button',
  text: string = 'Click me',
): CandidateScoringRow {
  return {
    candidate: {
      tag,
      text,
      attributes: {},
      structuralContext: 'no structural context',
    },
    baseConfidence: adjustedConfidence - 0.05,
    adjustedConfidence,
    hintScores,
  };
}

/** Build DiagnosticHintScore entries matching the two default hints */
function makeHintScores(roleMatched: boolean, textMatched: boolean): DiagnosticHintScore[] {
  return [
    { hint: 'role:button', weight: 1.0, matched: roleMatched, contribution: roleMatched ? 1.0 : 0 },
    { hint: 'text_contains:Submit', weight: 0.8, matched: textMatched, contribution: textMatched ? 0.8 : 0 },
  ];
}

describe('suggestFix', () => {
  it('Case 1: no candidates at all -- mentions "No elements matched" and references high-weight hints', () => {
    const diagnostic = makeDiagnostic({
      bestCandidateScore: null,
      confidenceGap: null,
      topCandidates: [],
    });

    const suggestion = suggestFix(diagnostic);

    expect(suggestion).toContain('No elements matched any hint');
    expect(suggestion).toContain('role:button');
    expect(suggestion).toContain('fully loaded');
  });

  it('Case 1b: no candidates, no high-weight hints -- mentions role or type hint', () => {
    const diagnostic = makeDiagnostic({
      searchedHints: [
        { type: 'class_contains', value: 'btn-primary' },
        { type: 'near_label', value: 'Email' },
      ],
      bestCandidateScore: null,
      confidenceGap: null,
      topCandidates: [],
    });

    const suggestion = suggestFix(diagnostic);

    expect(suggestion).toContain('No elements matched any hint');
    expect(suggestion).toContain("'role'");
  });

  it('Case 2: large gap (>= 0.40) with high-weight hints failed -- mentions high-weight hint failure', () => {
    const candidates = [
      makeCandidate(0.20, makeHintScores(false, false)),
      makeCandidate(0.15, makeHintScores(false, false)),
    ];

    const diagnostic = makeDiagnostic({
      bestCandidateScore: 0.20,
      confidenceGap: 0.50,
      topCandidates: candidates,
    });

    const suggestion = suggestFix(diagnostic);

    expect(suggestion).toContain('High-weight hint(s) failed');
    expect(suggestion).toContain('text_contains:Submit');
    expect(suggestion).toContain('0.20');
    expect(suggestion).toContain('may have changed');
  });

  it('Case 3: moderate gap (0.15-0.39) -- mentions disambiguating hints', () => {
    const candidates = [
      makeCandidate(0.50, makeHintScores(true, false)),
      makeCandidate(0.45, makeHintScores(true, false)),
      makeCandidate(0.40, makeHintScores(true, false)),
    ];

    const diagnostic = makeDiagnostic({
      bestCandidateScore: 0.50,
      confidenceGap: 0.20,
      topCandidates: candidates,
    });

    const suggestion = suggestFix(diagnostic);

    expect(suggestion).toContain('candidate(s) found');
    expect(suggestion).toContain('fieldset_context');
    expect(suggestion).toContain('associated_label');
    expect(suggestion).toContain('0.50');
  });

  it('Case 4: small gap (< 0.15) -- mentions "just below the threshold"', () => {
    const candidates = [
      makeCandidate(0.62, makeHintScores(true, false)),
    ];

    const diagnostic = makeDiagnostic({
      bestCandidateScore: 0.62,
      confidenceGap: 0.08,
      topCandidates: candidates,
    });

    const suggestion = suggestFix(diagnostic);

    expect(suggestion).toContain('0.62');
    expect(suggestion).toContain('just below the threshold');
    expect(suggestion).toContain('class_contains');
  });

  it('Case 5: all hints matched but still below threshold (structural edge case)', () => {
    // Both hints match but with low weights due to partial matching,
    // so the candidate still ends up below threshold
    const candidates = [
      makeCandidate(0.60, [
        { hint: 'role:button', weight: 1.0, matched: true, contribution: 1.0 },
        { hint: 'text_contains:Submit', weight: 0.8, matched: true, contribution: 0.8 },
      ]),
    ];

    const diagnostic = makeDiagnostic({
      bestCandidateScore: 0.60,
      confidenceGap: 0.10,
      topCandidates: candidates,
    });

    const suggestion = suggestFix(diagnostic);

    // Should still produce a reasonable suggestion -- Case 4 (small gap)
    expect(suggestion).toContain('0.60');
    expect(typeof suggestion).toBe('string');
    expect(suggestion.length).toBeGreaterThan(20);
  });
});
