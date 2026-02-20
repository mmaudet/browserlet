import { describe, it, expect } from 'vitest';
import { formatDiagnosticText, formatDiagnosticJSON } from '../../../packages/cli/src/diagnostic/formatter.js';
import type { DiagnosticReport } from '../../../packages/cli/src/diagnostic/types.js';
import type { FailureDiagnostic, CandidateScoringRow } from '@browserlet/core/types';

/** Strip ANSI color codes for assertion */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Minimal FailureDiagnostic factory */
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

/** Build a report with a suggestion string */
function makeReport(diagnosticOverrides: Partial<FailureDiagnostic> = {}, suggestion?: string): DiagnosticReport {
  return {
    diagnostic: makeDiagnostic(diagnosticOverrides),
    suggestion: suggestion ?? 'Try updating the hints to match the current page.',
  };
}

/** Build a CandidateScoringRow */
function makeCandidate(tag: string, text: string, adjustedConfidence: number): CandidateScoringRow {
  return {
    candidate: {
      tag,
      text,
      attributes: { role: 'button', id: 'btn-1' },
      structuralContext: "inside fieldset 'Login'",
    },
    baseConfidence: adjustedConfidence - 0.05,
    adjustedConfidence,
    hintScores: [
      { hint: 'role:button', weight: 1.0, matched: true, contribution: 1.0 },
      { hint: 'text_contains:Submit', weight: 0.8, matched: false, contribution: 0 },
    ],
  };
}

describe('formatDiagnosticText', () => {
  it('renders correctly with no candidates', () => {
    const report = makeReport({}, 'No elements matched. Check the page has loaded.');
    const output = formatDiagnosticText(report);
    const plain = stripAnsi(output);

    expect(plain).toContain('FAILURE DIAGNOSTIC');
    expect(plain).toContain('step: click-submit');
    expect(plain).toContain('Threshold:   0.70');
    expect(plain).toContain('none');
    expect(plain).toContain('no candidates found');
    expect(plain).toContain('role');
    expect(plain).toContain('text_contains');
    expect(plain).toContain('No candidates found');
    expect(plain).toContain('Suggested fix');
    expect(plain).toContain('No elements matched');
  });

  it('renders correctly with 2 candidates', () => {
    const candidates = [
      makeCandidate('button', 'Submit Order', 0.55),
      makeCandidate('a', 'Submit Form', 0.42),
    ];

    const report = makeReport({
      bestCandidateScore: 0.55,
      confidenceGap: 0.15,
      topCandidates: candidates,
    }, 'Add disambiguating hints.');

    const output = formatDiagnosticText(report);
    const plain = stripAnsi(output);

    expect(plain).toContain('Candidate 1');
    expect(plain).toContain('Candidate 2');
    expect(plain).toContain('button');
    expect(plain).toContain('Submit Order');
    expect(plain).toContain('Suggested fix');
    expect(plain).toContain('Candidate scoring');
    expect(plain).toContain('Expected vs found');
  });
});

describe('formatDiagnosticJSON', () => {
  it('produces valid JSON', () => {
    const report = makeReport();
    const output = formatDiagnosticJSON(report);

    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('JSON has required top-level keys', () => {
    const report = makeReport({
      bestCandidateScore: 0.50,
      confidenceGap: 0.20,
      topCandidates: [makeCandidate('button', 'Submit', 0.50)],
    });

    const output = formatDiagnosticJSON(report);
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty('step');
    expect(parsed).toHaveProperty('page');
    expect(parsed).toHaveProperty('timestamp');
    expect(parsed).toHaveProperty('failed_at_stage');
    expect(parsed).toHaveProperty('confidence');
    expect(parsed).toHaveProperty('searched_hints');
    expect(parsed).toHaveProperty('top_candidates');
    expect(parsed).toHaveProperty('suggestion');
  });

  it('confidence object has threshold, best_score, and gap', () => {
    const report = makeReport({
      bestCandidateScore: 0.55,
      confidenceGap: 0.15,
    });

    const output = formatDiagnosticJSON(report);
    const parsed = JSON.parse(output);

    expect(parsed.confidence).toHaveProperty('threshold', 0.70);
    expect(parsed.confidence).toHaveProperty('best_score', 0.55);
    expect(parsed.confidence).toHaveProperty('gap', 0.15);
  });

  it('top_candidates array has correct structure', () => {
    const candidates = [makeCandidate('button', 'Submit', 0.50)];
    const report = makeReport({
      bestCandidateScore: 0.50,
      confidenceGap: 0.20,
      topCandidates: candidates,
    });

    const output = formatDiagnosticJSON(report);
    const parsed = JSON.parse(output);

    expect(parsed.top_candidates).toHaveLength(1);
    const cand = parsed.top_candidates[0];
    expect(cand).toHaveProperty('tag', 'button');
    expect(cand).toHaveProperty('text', 'Submit');
    expect(cand).toHaveProperty('attributes');
    expect(cand).toHaveProperty('structural_context');
    expect(cand).toHaveProperty('base_confidence');
    expect(cand).toHaveProperty('adjusted_confidence');
    expect(cand).toHaveProperty('hint_scores');
  });

  it('searched_hints preserves hint structure', () => {
    const report = makeReport();
    const output = formatDiagnosticJSON(report);
    const parsed = JSON.parse(output);

    expect(parsed.searched_hints).toHaveLength(2);
    expect(parsed.searched_hints[0]).toEqual({ type: 'role', value: 'button' });
    expect(parsed.searched_hints[1]).toEqual({ type: 'text_contains', value: 'Submit' });
  });
});
