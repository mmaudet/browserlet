/**
 * DOMContextExtractor - Extracts enriched structural DOM context for playback resolution
 *
 * Purpose: Provides additional structural signals (fieldset, labels, proximity, siblings,
 * landmarks, headings) that StructuralScorer uses to differentiate elements that share
 * identical hints (e.g., two "Email" inputs in billing vs shipping fieldsets).
 *
 * All functions are pure (input element, output context) with no side effects or storage access.
 * All DOM traversals are bounded: O(depth), not O(n) total DOM nodes. (RSLV-13)
 */

import { findAssociatedLabel } from '../../../utils/hints/dom';
import { normalizeText } from '../../../utils/hints/text';

/** Enriched structural DOM context for a candidate element */
export interface DOMContext {
  /** Fieldset legend text if element is inside a fieldset (RSLV-01) */
  fieldset_legend: string | null;
  /** Associated label text via for= or aria-labelledby (RSLV-02) */
  associated_label: string | null;
  /** Near label text found by DOM tree proximity walk, with distance (RSLV-03) */
  near_label: { text: string; distance: number } | null;
  /** Text content of previous and next 3 siblings (RSLV-04) */
  sibling_texts: { before: string[]; after: string[] };
  /** Nearest ARIA landmark region (nav, main, aside, header, footer, form) */
  landmark: string | null;
  /** Nearest section heading text (h1-h6) */
  section_heading: string | null;
}

/** Form control tags to skip when looking for label-like text */
const FORM_CONTROL_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON']);

/** Tag-to-landmark-role mapping for implicit landmark roles */
const TAG_TO_LANDMARK: Record<string, string> = {
  NAV: 'navigation',
  MAIN: 'main',
  ASIDE: 'complementary',
  HEADER: 'banner',
  FOOTER: 'contentinfo',
  FORM: 'form',
};

/** Role attribute values that are landmarks */
const LANDMARK_ROLES = new Set([
  'navigation', 'main', 'complementary', 'banner', 'contentinfo', 'form', 'search',
]);

/**
 * Extract enriched structural DOM context for an element.
 * Synchronous -- DOM traversal only, no async.
 */
export function extractDOMContext(element: Element): DOMContext {
  return {
    fieldset_legend: extractFieldsetLegend(element),
    associated_label: extractAssociatedLabel(element),
    near_label: extractNearLabel(element),
    sibling_texts: extractSiblingTexts(element),
    landmark: extractLandmark(element),
    section_heading: extractSectionHeading(element),
  };
}

/**
 * Sub-extractor 1: Fieldset legend (RSLV-01)
 * Find nearest ancestor fieldset and return its direct-child legend text.
 * Performance: O(depth) -- single closest() up, single querySelector down.
 */
function extractFieldsetLegend(element: Element): string | null {
  const fieldset = element.closest('fieldset');
  if (!fieldset) return null;

  // Direct-child legend only -- avoids nested fieldset legends
  const legend = fieldset.querySelector(':scope > legend');
  if (!legend) return null;

  const text = normalizeText(legend.textContent);
  return text || null;
}

/**
 * Sub-extractor 2: Associated label (RSLV-02)
 * Resolves via aria-labelledby, label[for], or parent label.
 * Distinct from findAssociatedLabel() in dom.ts because it handles aria-labelledby
 * (which the existing utility does NOT) and returns text instead of the element.
 */
function extractAssociatedLabel(element: Element): string | null {
  // Method 1: aria-labelledby (concatenate referenced element texts)
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/).filter(Boolean);
    const texts: string[] = [];
    for (const id of ids) {
      const referencedEl = document.getElementById(id);
      if (referencedEl) {
        const text = normalizeText(referencedEl.textContent);
        if (text) texts.push(text);
      }
    }
    if (texts.length > 0) {
      return texts.join(' ');
    }
  }

  // Methods 2-3: Delegate to existing findAssociatedLabel for label[for] and parent label
  const labelElement = findAssociatedLabel(element);
  if (labelElement) {
    const text = normalizeText(labelElement.textContent);
    return text || null;
  }

  return null;
}

/**
 * Sub-extractor 3: Near label proximity walk (RSLV-03)
 * Walk up the DOM tree from the element, looking for label-like text at each level.
 * Returns the closest match with its distance (1 = parent, 2 = grandparent, etc.).
 * Performance: O(maxDepth * siblings_per_level), bounded.
 */
function extractNearLabel(element: Element, maxDepth: number = 3): { text: string; distance: number } | null {
  let current = element.parentElement;
  let distance = 1;

  while (current && distance <= maxDepth) {
    // Look through children of the current ancestor for label-like elements
    for (const child of current.children) {
      // Skip the element itself and its descendants
      if (child === element || child.contains(element)) continue;

      // Skip form controls -- we want label-like text only
      if (FORM_CONTROL_TAGS.has(child.tagName)) continue;

      // Check if child is a label-like element with short text
      const isLabelLike =
        child.tagName === 'LABEL' ||
        child.tagName === 'LEGEND' ||
        child.tagName === 'DT' ||
        child.tagName === 'STRONG' ||
        (child.tagName === 'SPAN' && (child.textContent?.length ?? 0) < 50);

      if (isLabelLike) {
        const text = normalizeText(child.textContent);
        if (text) {
          return { text, distance };
        }
      }
    }

    // Also check for text nodes directly in the ancestor
    for (const node of current.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = normalizeText(node.textContent);
        if (text && text.length < 50) {
          return { text, distance };
        }
      }
    }

    current = current.parentElement;
    distance++;
  }

  return null;
}

/**
 * Sub-extractor 4: Sibling texts (RSLV-04)
 * Collect textContent from up to 3 previous and 3 next siblings.
 * Skips siblings that are form controls.
 * Performance: O(1) -- bounded to 6 siblings max.
 */
function extractSiblingTexts(element: Element): { before: string[]; after: string[] } {
  const parent = element.parentElement;
  if (!parent) return { before: [], after: [] };

  const children = Array.from(parent.children);
  const index = children.indexOf(element);
  if (index === -1) return { before: [], after: [] };

  const before: string[] = [];
  const after: string[] = [];

  // Collect up to 3 previous siblings (going backwards)
  for (let i = index - 1; i >= 0 && before.length < 3; i--) {
    const sibling = children[i]!;
    if (FORM_CONTROL_TAGS.has(sibling.tagName)) continue;
    const text = normalizeText(sibling.textContent);
    if (text) before.push(text);
  }

  // Collect up to 3 next siblings (going forwards)
  for (let i = index + 1; i < children.length && after.length < 3; i++) {
    const sibling = children[i]!;
    if (FORM_CONTROL_TAGS.has(sibling.tagName)) continue;
    const text = normalizeText(sibling.textContent);
    if (text) after.push(text);
  }

  // Reverse 'before' so it's in DOM order (closest first)
  before.reverse();

  return { before, after };
}

/**
 * Sub-extractor 5: Landmark region
 * Find the nearest ARIA landmark ancestor.
 * Performance: O(depth) -- single closest() call.
 */
function extractLandmark(element: Element): string | null {
  const landmark = element.closest(
    'nav, main, aside, header, footer, form, ' +
    '[role="navigation"], [role="main"], [role="complementary"], ' +
    '[role="banner"], [role="contentinfo"], [role="form"], [role="search"]'
  );

  if (!landmark) return null;

  // Check explicit role attribute first
  const explicitRole = landmark.getAttribute('role');
  if (explicitRole && LANDMARK_ROLES.has(explicitRole)) {
    return explicitRole;
  }

  // Fall back to implicit role from tag name
  return TAG_TO_LANDMARK[landmark.tagName] || null;
}

/**
 * Sub-extractor 6: Section heading
 * Walk up from element through ancestors (max 5 levels), looking for nearby h1-h6.
 * Stops at landmark boundaries.
 * Performance: O(depth * siblings) -- bounded to 5 levels.
 */
function extractSectionHeading(element: Element): string | null {
  let current: Element | null = element;
  let level = 0;
  const maxLevels = 5;

  while (current && level < maxLevels) {
    const parent: Element | null = current.parentElement;
    if (!parent) break;

    // Stop at landmark boundaries
    const parentRole = parent.getAttribute('role');
    if (
      (parentRole && LANDMARK_ROLES.has(parentRole)) ||
      TAG_TO_LANDMARK[parent.tagName]
    ) {
      // Check this landmark's direct child headings before stopping
      const heading = parent.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
      if (heading) {
        const text = normalizeText(heading.textContent);
        if (text) return text;
      }
      break;
    }

    // Look backwards through previous siblings for headings
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName)) {
        const text = normalizeText(sibling.textContent);
        if (text) return text;
      }
      sibling = sibling.previousElementSibling;
    }

    // Check if parent itself has a direct child heading (before the element)
    for (const child of parent.children) {
      if (child === current) break; // Only check before the element
      if (/^H[1-6]$/.test(child.tagName)) {
        const text = normalizeText(child.textContent);
        if (text) return text;
      }
    }

    current = parent;
    level++;
  }

  return null;
}
