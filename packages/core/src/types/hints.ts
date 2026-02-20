/**
 * Semantic hint types for element identification
 *
 * These types are shared between recording (hint generation) and
 * playback (element resolution). They define the hint vocabulary
 * that makes BSL scripts resilient to DOM changes.
 */

// Semantic hint types (15 types: 10 from POC + 4 structural context + 1 positional)
export type HintType =
  | 'role'
  | 'text_contains'
  | 'type'
  | 'name'
  | 'placeholder_contains'
  | 'aria_label'
  | 'near_label'
  | 'class_contains'
  | 'data_attribute'
  | 'id'
  | 'fieldset_context'
  | 'associated_label'
  | 'section_context'
  | 'landmark_context'   // nearest ARIA landmark region (navigation, main, search, form, banner, contentinfo)
  | 'position_context';  // positional disambiguation (e.g. "row 3 of 5") when sibling elements are identical

// Captured semantic hint
export interface SemanticHint {
  type: HintType;
  value: string | { name: string; value: string }; // data_attribute uses object
}
