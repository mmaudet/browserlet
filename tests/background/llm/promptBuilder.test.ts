import { describe, it, expect } from 'vitest';

import {
  detectLayoutType,
  sortHintsByWeight,
  buildBSLPrompt,
  buildCompactBSLPrompt,
} from '@/entrypoints/background/llm/promptBuilder';
import type { LayoutType } from '@/entrypoints/background/llm/promptBuilder';
import type { CapturedAction } from '@/entrypoints/content/recording/types';
import type { SemanticHint } from '@browserlet/core/types';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeAction(hints: SemanticHint[]): CapturedAction {
  return {
    type: 'click',
    timestamp: 0,
    url: 'https://example.com',
    hints,
    isIframe: false,
  };
}

// ---------------------------------------------------------------------------
// detectLayoutType
// ---------------------------------------------------------------------------

describe('detectLayoutType', () => {
  it('returns generic for empty actions', () => {
    expect(detectLayoutType([])).toBe('generic');
  });

  it('returns generic for simple click/type actions with no table or SPA signals', () => {
    const actions = [
      makeAction([
        { type: 'role', value: 'textbox' },
        { type: 'name', value: 'email' },
        { type: 'placeholder_contains', value: 'enter email' },
      ]),
      makeAction([
        { type: 'role', value: 'button' },
        { type: 'text_contains', value: 'Submit' },
      ]),
    ];
    expect(detectLayoutType(actions)).toBe('generic');
  });

  it('returns legacy-table when 2+ table role hints detected (cell/columnheader)', () => {
    const actions = [
      makeAction([{ type: 'role', value: 'cell' }, { type: 'text_contains', value: 'Dupont' }]),
      makeAction([{ type: 'role', value: 'columnheader' }, { type: 'text_contains', value: 'Name' }]),
    ];
    expect(detectLayoutType(actions)).toBe('legacy-table');
  });

  it('returns legacy-table when actions include rowheader hints', () => {
    const actions = [
      makeAction([{ type: 'role', value: 'rowheader' }]),
      makeAction([{ type: 'role', value: 'cell' }]),
    ];
    expect(detectLayoutType(actions)).toBe('legacy-table');
  });

  it('returns legacy-table when role=row counted among table signals', () => {
    // role=row IS included in the detection (cell/columnheader/rowheader/row)
    const actions = [
      makeAction([{ type: 'role', value: 'row' }]),
      makeAction([{ type: 'role', value: 'cell' }]),
    ];
    expect(detectLayoutType(actions)).toBe('legacy-table');
  });

  it('returns spa-component when 2+ SPA data attributes detected', () => {
    const actions = [
      makeAction([{ type: 'data_attribute', value: { name: 'data-slot', value: 'navigation-menu-link' } }]),
      makeAction([{ type: 'data_attribute', value: { name: 'data-radix-collection-item', value: '' } }]),
    ];
    expect(detectLayoutType(actions)).toBe('spa-component');
  });

  it('returns spa-component when data-component attributes detected', () => {
    const actions = [
      makeAction([{ type: 'data_attribute', value: { name: 'data-component', value: 'Header' } }]),
      makeAction([{ type: 'data_attribute', value: { name: 'data-component', value: 'Sidebar' } }]),
    ];
    expect(detectLayoutType(actions)).toBe('spa-component');
  });

  it('returns spa-component when Vue data-v- attributes detected', () => {
    const actions = [
      makeAction([{ type: 'data_attribute', value: { name: 'data-v-abc123', value: '' } }]),
      makeAction([{ type: 'data_attribute', value: { name: 'data-v-def456', value: '' } }]),
    ];
    expect(detectLayoutType(actions)).toBe('spa-component');
  });

  it('returns spa-component when React-generated ID hints present (2+)', () => {
    const actions = [
      makeAction([{ type: 'id', value: ':r1:' }]),
      makeAction([{ type: 'id', value: ':r2:' }]),
    ];
    expect(detectLayoutType(actions)).toBe('spa-component');
  });

  it('returns spa-component when data-react attributes detected', () => {
    const actions = [
      makeAction([{ type: 'data_attribute', value: { name: 'data-reactid', value: '123' } }]),
      makeAction([{ type: 'data_attribute', value: { name: 'data-react-fiber', value: 'abc' } }]),
    ];
    expect(detectLayoutType(actions)).toBe('spa-component');
  });

  it('returns legacy-table when tableSignals > spaSignals and both >= 2', () => {
    const actions = [
      makeAction([
        { type: 'role', value: 'cell' },
        { type: 'data_attribute', value: { name: 'data-slot', value: 'cell' } },
      ]),
      makeAction([{ type: 'role', value: 'columnheader' }]),
      makeAction([{ type: 'role', value: 'rowheader' }]),
    ];
    // tableSignals = 3, spaSignals = 1 (data-slot)
    expect(detectLayoutType(actions)).toBe('legacy-table');
  });

  it('returns generic when both tableSignals and spaSignals < 2', () => {
    const actions = [
      makeAction([
        { type: 'role', value: 'cell' },          // 1 table signal
        { type: 'data_attribute', value: { name: 'data-slot', value: 'menu' } }, // 1 SPA signal
      ]),
    ];
    // tableSignals = 1, spaSignals = 1, both < 2
    expect(detectLayoutType(actions)).toBe('generic');
  });

  it('section_context contributes 0.5 SPA signal (weaker)', () => {
    // 4 section_context hints = 2.0 SPA signals, just enough
    const actions = [
      makeAction([{ type: 'section_context', value: 'Dashboard' }]),
      makeAction([{ type: 'section_context', value: 'Settings' }]),
      makeAction([{ type: 'section_context', value: 'Profile' }]),
      makeAction([{ type: 'section_context', value: 'Analytics' }]),
    ];
    expect(detectLayoutType(actions)).toBe('spa-component');
  });

  it('non-SPA data attributes do not count as SPA signals', () => {
    const actions = [
      makeAction([{ type: 'data_attribute', value: { name: 'data-testid', value: 'login-btn' } }]),
      makeAction([{ type: 'data_attribute', value: { name: 'data-cy', value: 'email-input' } }]),
    ];
    // data-testid and data-cy are generic, not SPA-specific
    expect(detectLayoutType(actions)).toBe('generic');
  });
});

// ---------------------------------------------------------------------------
// buildBSLPrompt - layout guidance injection
// ---------------------------------------------------------------------------

describe('buildBSLPrompt - layout guidance', () => {
  it('includes legacy table guidance when legacy-table layout detected', () => {
    const actions = [
      makeAction([{ type: 'role', value: 'cell' }, { type: 'text_contains', value: 'Dupont' }]),
      makeAction([{ type: 'role', value: 'columnheader' }, { type: 'text_contains', value: 'Name' }]),
    ];

    const prompt = buildBSLPrompt(actions);

    expect(prompt).toContain('Legacy HTML Table Structure');
    expect(prompt).toContain('role=cell with text_contains');
    expect(prompt).toContain('role=columnheader');
    expect(prompt).toContain('Do NOT use role=row as a target');
  });

  it('includes SPA guidance when spa-component layout detected', () => {
    const actions = [
      makeAction([{ type: 'data_attribute', value: { name: 'data-slot', value: 'nav-link' } }]),
      makeAction([{ type: 'data_attribute', value: { name: 'data-radix-menu', value: '' } }]),
    ];

    const prompt = buildBSLPrompt(actions);

    expect(prompt).toContain('Modern SPA Component Structure');
    expect(prompt).toContain('wait_for step before the next action');
    expect(prompt).toContain('data_attribute hints');
    expect(prompt).toContain('React portals');
  });

  it('does not include layout section for generic actions', () => {
    const actions = [
      makeAction([{ type: 'role', value: 'button' }, { type: 'text_contains', value: 'OK' }]),
    ];

    const prompt = buildBSLPrompt(actions);

    expect(prompt).not.toContain('Legacy HTML Table Structure');
    expect(prompt).not.toContain('Modern SPA Component Structure');
  });
});

// ---------------------------------------------------------------------------
// buildCompactBSLPrompt - layout note
// ---------------------------------------------------------------------------

describe('buildCompactBSLPrompt - layout note', () => {
  it('includes legacy-table note for table actions', () => {
    const actions = [
      makeAction([{ type: 'role', value: 'cell' }]),
      makeAction([{ type: 'role', value: 'columnheader' }]),
    ];

    const prompt = buildCompactBSLPrompt(actions);

    expect(prompt).toContain('Layout: HTML table');
    expect(prompt).toContain('role=cell/columnheader');
  });

  it('includes SPA note for SPA actions', () => {
    const actions = [
      makeAction([{ type: 'data_attribute', value: { name: 'data-slot', value: 'link' } }]),
      makeAction([{ type: 'data_attribute', value: { name: 'data-radix-item', value: '' } }]),
    ];

    const prompt = buildCompactBSLPrompt(actions);

    expect(prompt).toContain('Layout: SPA');
    expect(prompt).toContain('wait_for after route changes');
  });

  it('no layout note for generic actions', () => {
    const actions = [
      makeAction([{ type: 'role', value: 'button' }]),
    ];

    const prompt = buildCompactBSLPrompt(actions);

    // Check that neither layout note pattern appears
    expect(prompt).not.toContain('Layout: HTML table');
    expect(prompt).not.toContain('Layout: SPA');
  });
});

// ---------------------------------------------------------------------------
// sortHintsByWeight (smoke test — full suite in hintPreservationAudit.test.ts)
// ---------------------------------------------------------------------------

describe('sortHintsByWeight (smoke)', () => {
  it('sorts data_attribute before class_contains', () => {
    const hints: SemanticHint[] = [
      { type: 'class_contains', value: 'btn' },
      { type: 'data_attribute', value: { name: 'data-testid', value: 'x' } },
    ];
    const sorted = sortHintsByWeight(hints);
    expect(sorted[0]!.type).toBe('data_attribute');
    expect(sorted[1]!.type).toBe('class_contains');
  });
});
