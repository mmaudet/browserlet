/**
 * Semantic hint types for element identification
 *
 * These types are shared between recording (hint generation) and
 * playback (element resolution). They define the hint vocabulary
 * that makes BSL scripts resilient to DOM changes.
 */

// Semantic hint types (13 types: 10 from POC + 3 structural context)
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
  | 'section_context';

// Captured semantic hint
export interface SemanticHint {
  type: HintType;
  value: string | { name: string; value: string }; // data_attribute uses object
}
