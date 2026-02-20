/**
 * Hint weights for scoring element matches
 *
 * Higher weight = more reliable for identification.
 * Used by the semantic resolver during playback to score
 * how well a DOM element matches recorded hints.
 */

import type { HintType } from './hints.js';

export const HINT_WEIGHTS: Record<HintType, number> = {
  data_attribute: 1.0,  // Most reliable - stable across deployments
  role: 1.0,            // ARIA role - semantic and stable
  type: 1.0,            // Input type - fundamental to element
  aria_label: 0.9,      // Accessibility label - usually stable
  name: 0.9,            // Form name attribute - stable
  id: 0.85,             // Filtered for auto-generated in recording
  text_contains: 0.8,   // Text content - may change with i18n
  placeholder_contains: 0.7, // Placeholder text - may change
  fieldset_context: 0.7, // Fieldset legend - critical for form section disambiguation
  associated_label: 0.7, // Explicit label association (for=/aria-labelledby)
  landmark_context: 0.65, // ARIA landmark region - page structure context
  section_context: 0.6,  // Section heading - page section disambiguation
  near_label: 0.6,      // Less reliable in tables/complex layouts
  position_context: 0.55, // Positional disambiguation - fragile if rows reorder but critical for table rows
  class_contains: 0.5,  // Often minified/generated
};
