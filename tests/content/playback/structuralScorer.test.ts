import { describe, it, expect } from 'vitest';

import {
  computeStructuralBoost,
  STRUCTURAL_BOOST_VALUES,
} from '../../../entrypoints/content/playback/structuralScorer';
import type { DOMContext } from '../../../entrypoints/content/playback/domContextExtractor';
import type { SemanticHint } from '../../../entrypoints/content/playback/types';

/** Helper: create a DOMContext with all null/empty fields */
function emptyContext(): DOMContext {
  return {
    fieldset_legend: null,
    associated_label: null,
    near_label: null,
    sibling_texts: { before: [], after: [] },
    landmark: null,
    section_heading: null,
  };
}

describe('computeStructuralBoost', () => {
  // -----------------------------------------------------------------------
  // Individual boost signals
  // -----------------------------------------------------------------------

  it('should return +0.15 for fieldset legend match', () => {
    const ctx: DOMContext = {
      ...emptyContext(),
      fieldset_legend: 'Billing Address',
    };
    const hints: SemanticHint[] = [
      { type: 'near_label', value: 'Billing' },
    ];

    const result = computeStructuralBoost(ctx, hints);
    expect(result.total).toBeCloseTo(0.15);
    expect(result.details).toHaveLength(1);
    expect(result.details[0]!.type).toBe('fieldset');
    expect(result.details[0]!.boost).toBe(STRUCTURAL_BOOST_VALUES.FIELDSET_LEGEND);
  });

  it('should return +0.15 for associated label match', () => {
    const ctx: DOMContext = {
      ...emptyContext(),
      associated_label: 'Email Address',
    };
    const hints: SemanticHint[] = [
      { type: 'near_label', value: 'Email' },
    ];

    const result = computeStructuralBoost(ctx, hints);
    expect(result.total).toBeCloseTo(0.15);
    expect(result.details).toHaveLength(1);
    expect(result.details[0]!.type).toBe('label');
  });

  it('should return +0.10 for near_label at distance 1', () => {
    const ctx: DOMContext = {
      ...emptyContext(),
      near_label: { text: 'Username', distance: 1 },
    };
    const hints: SemanticHint[] = [
      { type: 'near_label', value: 'Username' },
    ];

    const result = computeStructuralBoost(ctx, hints);
    expect(result.total).toBeCloseTo(0.10);
    expect(result.details[0]!.type).toBe('near_label');
  });

  it('should return ~0.067 for near_label at distance 2', () => {
    const ctx: DOMContext = {
      ...emptyContext(),
      near_label: { text: 'Password', distance: 2 },
    };
    const hints: SemanticHint[] = [
      { type: 'near_label', value: 'Password' },
    ];

    const result = computeStructuralBoost(ctx, hints);
    // distanceWeight = 1 - (2-1)/3 = 2/3; boost = 0.10 * 2/3 ≈ 0.0667
    expect(result.total).toBeCloseTo(0.0667, 3);
  });

  it('should return ~0.033 for near_label at distance 3', () => {
    const ctx: DOMContext = {
      ...emptyContext(),
      near_label: { text: 'Confirm', distance: 3 },
    };
    const hints: SemanticHint[] = [
      { type: 'text_contains', value: 'Confirm' },
    ];

    const result = computeStructuralBoost(ctx, hints);
    // distanceWeight = 1 - (3-1)/3 = 1/3; boost = 0.10 * 1/3 ≈ 0.0333
    expect(result.total).toBeCloseTo(0.0333, 3);
  });

  it('should return +0.10 for landmark match', () => {
    const ctx: DOMContext = {
      ...emptyContext(),
      landmark: 'navigation',
    };
    const hints: SemanticHint[] = [
      { type: 'role', value: 'navigation' },
    ];

    const result = computeStructuralBoost(ctx, hints);
    expect(result.total).toBeCloseTo(0.10);
    expect(result.details[0]!.type).toBe('landmark');
  });

  it('should return +0.08 for section heading match', () => {
    const ctx: DOMContext = {
      ...emptyContext(),
      section_heading: 'Account Settings',
    };
    const hints: SemanticHint[] = [
      { type: 'text_contains', value: 'Account' },
    ];

    const result = computeStructuralBoost(ctx, hints);
    expect(result.total).toBeCloseTo(0.08);
    expect(result.details[0]!.type).toBe('heading');
  });

  // -----------------------------------------------------------------------
  // No match
  // -----------------------------------------------------------------------

  it('should return 0 when no context matches hints', () => {
    const ctx: DOMContext = {
      ...emptyContext(),
      fieldset_legend: 'Shipping',
      associated_label: 'Phone Number',
    };
    const hints: SemanticHint[] = [
      { type: 'near_label', value: 'Totally Different' },
    ];

    const result = computeStructuralBoost(ctx, hints);
    expect(result.total).toBe(0);
    expect(result.details).toHaveLength(0);
  });

  it('should return 0 when all context fields are null/empty', () => {
    const ctx = emptyContext();
    const hints: SemanticHint[] = [
      { type: 'role', value: 'button' },
      { type: 'text_contains', value: 'Submit' },
    ];

    const result = computeStructuralBoost(ctx, hints);
    expect(result.total).toBe(0);
    expect(result.details).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Combination & cap
  // -----------------------------------------------------------------------

  it('should cap combined boosts at 0.35', () => {
    const ctx: DOMContext = {
      ...emptyContext(),
      fieldset_legend: 'Billing',        // +0.15
      associated_label: 'Email',         // +0.15
      near_label: { text: 'Email', distance: 1 },  // +0.10
      landmark: 'form',                  // +0.10
      section_heading: 'Billing',        // +0.08
    };
    const hints: SemanticHint[] = [
      { type: 'near_label', value: 'Email' },
      { type: 'text_contains', value: 'Billing' },
      { type: 'role', value: 'form' },
    ];

    const result = computeStructuralBoost(ctx, hints);
    // Sum without cap = 0.15 + 0.15 + 0.10 + 0.10 + 0.08 = 0.58
    expect(result.total).toBe(0.35);
    expect(result.details.length).toBeGreaterThan(1);
  });

  it('should accumulate multiple boosts below cap', () => {
    const ctx: DOMContext = {
      ...emptyContext(),
      fieldset_legend: 'Billing',        // +0.15
      associated_label: 'Email Address', // +0.15
    };
    const hints: SemanticHint[] = [
      { type: 'near_label', value: 'Billing' },
      { type: 'near_label', value: 'Email' },
    ];

    const result = computeStructuralBoost(ctx, hints);
    expect(result.total).toBeCloseTo(0.30);
    expect(result.details).toHaveLength(2);
  });

  // -----------------------------------------------------------------------
  // Billing vs Shipping disambiguation
  // -----------------------------------------------------------------------

  it('should differentiate Billing vs Shipping fieldsets', () => {
    const billingCtx: DOMContext = {
      ...emptyContext(),
      fieldset_legend: 'Billing Address',
    };
    const shippingCtx: DOMContext = {
      ...emptyContext(),
      fieldset_legend: 'Shipping Address',
    };

    // Hints that target "Billing"
    const billingHints: SemanticHint[] = [
      { type: 'near_label', value: 'Billing' },
      { type: 'type', value: 'email' },
    ];

    const billingBoost = computeStructuralBoost(billingCtx, billingHints);
    const shippingBoost = computeStructuralBoost(shippingCtx, billingHints);

    // Billing context should get the fieldset boost, shipping should not
    expect(billingBoost.total).toBeGreaterThan(0);
    expect(shippingBoost.total).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('should skip data_attribute hints (object values)', () => {
    const ctx: DOMContext = {
      ...emptyContext(),
      fieldset_legend: 'data-testid=submit',
    };
    const hints: SemanticHint[] = [
      { type: 'data_attribute', value: { name: 'data-testid', value: 'submit' } },
    ];

    const result = computeStructuralBoost(ctx, hints);
    // data_attribute has object value, hintValuesToStrings skips it
    expect(result.total).toBe(0);
  });

  it('should handle empty hints array', () => {
    const ctx: DOMContext = {
      ...emptyContext(),
      fieldset_legend: 'Billing',
    };

    const result = computeStructuralBoost(ctx, []);
    expect(result.total).toBe(0);
  });
});
