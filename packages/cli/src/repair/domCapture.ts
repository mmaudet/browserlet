/**
 * DOM context capture for repair engine
 *
 * Extracts a truncated DOM excerpt around the expected element location
 * when cascade resolution fails. The excerpt is sent to the LLM as context
 * for generating replacement hints.
 *
 * Phase 30 - Plan 30-01
 */

import type { Page } from 'playwright';
import type { BSLStep } from '@browserlet/core/types';

/** Maximum length of the DOM excerpt in characters */
const MAX_EXCERPT_LENGTH = 600;

/**
 * Capture DOM context around where a failed element was expected.
 *
 * Strategy:
 * 1. Use the step's intent/hints to find the closest structural landmark
 *    (form, section, main, fieldset, nav, header)
 * 2. Serialize a truncated excerpt of that region's innerHTML
 * 3. Fall back to document.body.innerHTML if no landmark found
 * 4. Strip script/style tags and excessive whitespace
 *
 * @param page - Playwright Page instance
 * @param step - The BSL step that failed resolution
 * @returns Cleaned DOM excerpt string (max 600 chars)
 */
export async function captureDOMContext(
  page: Page,
  step: BSLStep,
): Promise<string> {
  const intent = step.target?.intent ?? '';
  const hintValues = (step.target?.hints ?? [])
    .map(h => (typeof h.value === 'string' ? h.value : h.value?.name ?? ''))
    .filter(Boolean);

  try {
    const excerpt = await page.evaluate(
      ({ intent: searchIntent, hintValues: searchHints, maxLen }) => {
        // Helper: strip script/style tags and collapse whitespace
        function cleanHTML(html: string): string {
          return html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
        }

        // Structural landmarks to search for context
        const landmarks = document.querySelectorAll(
          'form, section, main, fieldset, nav, header, [role="main"], [role="form"], [role="navigation"]',
        );

        // Try to find a landmark that contains text matching hints or intent
        const searchTerms = [...searchHints];
        if (searchIntent) searchTerms.push(searchIntent);

        for (const landmark of landmarks) {
          const text = landmark.textContent ?? '';
          const html = landmark.innerHTML ?? '';
          const hasMatch = searchTerms.some(
            term => text.toLowerCase().includes(term.toLowerCase()) ||
                    html.toLowerCase().includes(term.toLowerCase()),
          );

          if (hasMatch) {
            const cleaned = cleanHTML(landmark.innerHTML);
            return cleaned.slice(0, maxLen);
          }
        }

        // Fallback: use document.body
        const bodyHTML = document.body?.innerHTML ?? '';
        const cleaned = cleanHTML(bodyHTML);
        return cleaned.slice(0, maxLen);
      },
      { intent, hintValues, maxLen: MAX_EXCERPT_LENGTH },
    );

    return excerpt;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[DOMCapture] Failed to capture DOM context: ${msg}`);
    return '';
  }
}
