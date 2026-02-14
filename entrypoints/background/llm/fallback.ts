/**
 * Fallback BSL generator (no LLM required)
 * Generates reliable BSL scripts directly from captured actions
 *
 * Improvements over LLM generation:
 * - Deterministic output (same input = same output)
 * - Preserves ALL actions faithfully
 * - Adds wait_for after navigation/link clicks
 * - Handles password credential placeholders
 * - No "creative" interpretation that breaks scripts
 */

import yaml from 'js-yaml';
import type { CapturedAction, ActionType } from '../../content/recording/types';
import type { SemanticHint } from '../../content/recording/types';

/**
 * BSL step structure (matches actual BSL format)
 */
interface BSLStep {
  action: string;
  target?: {
    hints: SemanticHint[];
    fallback_selector?: string;
  };
  value?: string;
  timeout?: string;
  output?: {
    variable: string;
    transform?: string;
  };
}

/**
 * BSL script structure
 */
interface BSLScript {
  name: string;
  version: string;
  description: string;
  steps: BSLStep[];
}

/**
 * Map captured action type to BSL action type
 */
function mapActionType(type: ActionType): string {
  switch (type) {
    case 'click':
      return 'click';
    case 'input':
      return 'type';
    case 'navigate':
      return 'navigate';
    case 'submit':
      return 'click';
    case 'screenshot':
      return 'screenshot';
    default:
      return type;
  }
}

/**
 * Check if an action is a navigation action (navigate or click on link)
 */
function isNavigationAction(action: CapturedAction): boolean {
  if (action.type === 'navigate') return true;

  // Click on a link (role: link or <a> element)
  if (action.type === 'click') {
    const roleHint = action.hints.find(h => h.type === 'role');
    if (roleHint && roleHint.value === 'link') return true;

    // Check fallback selector for links
    if (action.fallbackSelector?.startsWith('a[href')) return true;
  }

  return false;
}

/**
 * Check if action is on a form element (should be skipped - forms aren't clickable)
 */
function isFormAction(action: CapturedAction): boolean {
  // Check role hint
  const roleHint = action.hints.find(h => h.type === 'role');
  if (roleHint?.value === 'form') return true;

  // Check id hint (forms often have id like "lform", "loginform", etc.)
  const idHint = action.hints.find(h => h.type === 'id');
  if (idHint && typeof idHint.value === 'string') {
    const idLower = idHint.value.toLowerCase();
    if (idLower.includes('form') || idLower === 'lform') return true;
  }

  // Check fallback selector
  if (action.fallbackSelector?.startsWith('form')) return true;

  return false;
}

/**
 * Check if action is a submit button click
 */
function isSubmitAction(action: CapturedAction): boolean {
  if (action.type === 'submit') return true;

  const typeHint = action.hints.find(h => h.type === 'type');
  if (typeHint?.value === 'submit') return true;

  const textHint = action.hints.find(h => h.type === 'text_contains');
  if (textHint && typeof textHint.value === 'string') {
    const text = textHint.value.toLowerCase();
    if (text.includes('connect') || text.includes('login') || text.includes('submit') ||
        text.includes('envoyer') || text.includes('valider') || text.includes('rechercher')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if this is a password field
 */
function isPasswordField(action: CapturedAction): boolean {
  const typeHint = action.hints.find(h => h.type === 'type');
  return typeHint?.value === 'password';
}

/**
 * Get a descriptive name for the script based on actions
 */
function generateScriptName(actions: CapturedAction[], startUrl?: string): string {
  if (startUrl) {
    try {
      const url = new URL(startUrl);
      const hostname = url.hostname.replace('www.', '');
      return `${hostname} Automation`;
    } catch {
      // Ignore URL parse errors
    }
  }

  if (actions.length > 0 && actions[0].url) {
    try {
      const url = new URL(actions[0].url);
      const hostname = url.hostname.replace('www.', '');
      return `${hostname} Automation`;
    } catch {
      // Ignore URL parse errors
    }
  }

  return 'Recorded Script';
}

/**
 * Deduplicate consecutive actions on the same target
 * - Keeps only the last input/type action for each target (has complete value)
 * - Removes click followed by type on same element (redundant)
 * - Removes clicks on form elements (forms aren't clickable)
 * - Removes duplicate consecutive navigations to same URL
 */
function deduplicateActions(actions: CapturedAction[]): CapturedAction[] {
  const result: CapturedAction[] = [];
  let lastNavigateUrl: string | null = null;

  for (let i = 0; i < actions.length; i++) {
    const current = actions[i];
    if (!current) continue;

    // Skip clicks on form elements (meaningless)
    if (current.type === 'click' && isFormAction(current)) {
      console.log('[Fallback Generator] Skipping click on form:', current.hints);
      continue;
    }

    // Skip duplicate consecutive navigations to same URL
    if (current.type === 'navigate') {
      const url = current.targetUrl || current.url;
      // Normalize URL by removing hash and trailing slash
      const normalizedUrl = url?.replace(/#.*$/, '').replace(/\/$/, '');
      const normalizedLast = lastNavigateUrl?.replace(/#.*$/, '').replace(/\/$/, '');

      if (normalizedUrl && normalizedUrl === normalizedLast) {
        console.log('[Fallback Generator] Skipping duplicate navigation to:', url);
        continue;
      }
      lastNavigateUrl = url || null;
    } else {
      // Reset last navigate URL when we have a non-navigate action
      lastNavigateUrl = null;
    }

    const next = actions[i + 1];

    // If this is an input action and the next one is also input on the same target,
    // skip this one and keep the later one (which has the more complete value)
    if (current.type === 'input' && next?.type === 'input') {
      const currentName = current.hints.find(h => h.type === 'name')?.value;
      const nextName = next.hints.find(h => h.type === 'name')?.value;

      if (currentName && currentName === nextName) {
        continue;
      }
    }

    // Skip click immediately followed by type on same element (redundant)
    if (current.type === 'click' && next?.type === 'input') {
      const currentName = current.hints.find(h => h.type === 'name')?.value;
      const nextName = next.hints.find(h => h.type === 'name')?.value;

      if (currentName && currentName === nextName) {
        continue;
      }

      // Also check by placeholder
      const currentPlaceholder = current.hints.find(h => h.type === 'placeholder_contains')?.value;
      const nextPlaceholder = next.hints.find(h => h.type === 'placeholder_contains')?.value;

      if (currentPlaceholder && currentPlaceholder === nextPlaceholder) {
        continue;
      }
    }

    result.push(current);
  }

  return result;
}

/**
 * Filter hints to only include the most useful ones
 * Prioritizes: name, type, role, placeholder_contains, text_contains, near_label
 */
function filterHints(hints: SemanticHint[]): SemanticHint[] {
  const priority: Record<string, number> = {
    'name': 1,
    'type': 2,
    'id': 3,
    'role': 4,
    'placeholder_contains': 5,
    'text_contains': 6,
    'aria_label': 7,
    'fieldset_context': 8,     // Critical for form section disambiguation
    'associated_label': 9,     // Explicit label association
    'section_context': 10,     // Page section context
    'near_label': 11,          // Less precise than associated_label
    'data_attribute': 12,
    'class_contains': 13,
  };

  // Sort by priority and take top hints
  const sorted = [...hints].sort((a, b) => {
    const pa = priority[a.type] || 99;
    const pb = priority[b.type] || 99;
    return pa - pb;
  });

  // Take up to 4 hints normally, but allow 5 if structural hints are present
  // (fieldset_context/section_context are essential for disambiguation)
  const hasStructuralHints = sorted.some(h =>
    h.type === 'fieldset_context' || h.type === 'section_context'
  );
  const maxHints = hasStructuralHints ? 5 : 4;

  const result: SemanticHint[] = [];
  for (const hint of sorted) {
    if (result.length >= maxHints) break;

    // Skip class_contains if we already have 2+ good hints
    if (hint.type === 'class_contains' && result.length >= 2) continue;

    result.push(hint);
  }

  return result;
}

/**
 * Generate reliable BSL script from captured actions without LLM
 *
 * Features:
 * - Preserves all meaningful actions
 * - Adds wait_for after navigation/link clicks
 * - Handles password credentials with placeholders
 * - Removes meaningless actions (clicks on forms)
 * - Uses fallback_selector for links
 *
 * @param actions - Array of captured user actions
 * @param startUrl - Optional URL to navigate to at script start
 * @returns Valid BSL YAML string
 */
export function generateBasicBSL(actions: CapturedAction[], startUrl?: string): string {
  // Deduplicate and clean actions
  const dedupedActions = deduplicateActions(actions);

  const steps: BSLStep[] = [];

  // Prepend navigate to startUrl if provided
  if (startUrl) {
    steps.push({
      action: 'navigate',
      value: startUrl,
    });
  }

  // Track if we need to add a wait_for after navigation
  let lastWasNavigation = !!startUrl;
  let waitForHints: SemanticHint[] | null = null;

  for (let i = 0; i < dedupedActions.length; i++) {
    const action = dedupedActions[i];
    if (!action) continue;

    const bslAction = mapActionType(action.type);

    // Handle navigate action
    if (action.type === 'navigate') {
      steps.push({
        action: 'navigate',
        value: action.targetUrl || action.url,
      });
      lastWasNavigation = true;

      // Try to get hints from next action for wait_for
      const nextAction = dedupedActions[i + 1];
      if (nextAction && nextAction.hints.length > 0) {
        waitForHints = filterHints(nextAction.hints);
      }
      continue;
    }

    // Handle screenshot action
    if (action.type === 'screenshot') {
      steps.push({ action: 'screenshot' });
      continue;
    }

    // If last action was navigation, add wait_for before this action
    if (lastWasNavigation && action.hints.length > 0) {
      const hintsForWait = waitForHints || filterHints(action.hints);
      steps.push({
        action: 'wait_for',
        target: {
          hints: hintsForWait,
        },
        timeout: '10s',
      });
      lastWasNavigation = false;
      waitForHints = null;
    }

    // Build step with target
    const filteredHints = filterHints(action.hints);
    const step: BSLStep = {
      action: bslAction,
      target: {
        hints: filteredHints,
      },
    };

    // Add fallback_selector if available
    if (action.fallbackSelector) {
      step.target!.fallback_selector = action.fallbackSelector;
    }

    // Add value for type actions
    if (action.type === 'input' && action.value) {
      if (isPasswordField(action)) {
        // Use credential placeholder for passwords
        step.value = '{{credential:PASSWORD}}';
      } else if (action.value !== '[MASKED]') {
        step.value = action.value;
      }
    }

    // Check if this is a click on a link (navigation)
    if (action.type === 'click' && isNavigationAction(action)) {
      steps.push(step);
      lastWasNavigation = true;

      // Try to get hints from next action for wait_for
      const nextAction = dedupedActions[i + 1];
      if (nextAction && nextAction.hints.length > 0) {
        waitForHints = filterHints(nextAction.hints);
      }
      continue;
    }

    // Check if this is a submit action - add wait_for after
    if (isSubmitAction(action)) {
      steps.push(step);
      lastWasNavigation = true; // Treat submit like navigation

      const nextAction = dedupedActions[i + 1];
      if (nextAction && nextAction.hints.length > 0) {
        waitForHints = filterHints(nextAction.hints);
      }
      continue;
    }

    steps.push(step);
  }

  const script: BSLScript = {
    name: generateScriptName(dedupedActions, startUrl),
    version: '1.0.0',
    description: 'Auto-generated from recording',
    steps,
  };

  return yaml.dump(script, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
}
