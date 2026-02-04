/**
 * Fallback BSL generator (no LLM required)
 * Generates basic BSL scripts directly from captured actions
 */

import yaml from 'js-yaml';
import type { CapturedAction, ActionType } from '../../content/recording/types';
import type { SemanticHint } from '../../content/recording/types';

/**
 * BSL step structure
 */
interface BSLStep {
  action: string;
  target?: {
    intent: string;
    hints: SemanticHint[];
    fallback_selector?: string;
  };
  value?: string;
  url?: string;
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
 * @param type - Captured action type
 * @returns BSL action type string
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
      return 'click'; // Submit is a click on submit button
    default:
      return type;
  }
}

/**
 * Generate action intent description
 * @param action - Captured action
 * @param index - Step index (1-based)
 * @returns Human-readable intent string
 */
function generateIntent(action: CapturedAction, index: number): string {
  const actionVerb = mapActionType(action.type);

  // Try to generate meaningful intent from hints
  const textHint = action.hints.find(h => h.type === 'text_contains');
  const roleHint = action.hints.find(h => h.type === 'role');
  const labelHint = action.hints.find(h => h.type === 'aria_label' || h.type === 'near_label');
  const placeholderHint = action.hints.find(h => h.type === 'placeholder_contains');

  if (textHint && typeof textHint.value === 'string') {
    return `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} "${textHint.value}" ${roleHint ? roleHint.value : 'element'}`;
  }

  if (labelHint && typeof labelHint.value === 'string') {
    return `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} ${labelHint.value} field`;
  }

  if (placeholderHint && typeof placeholderHint.value === 'string') {
    return `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)} "${placeholderHint.value}" input`;
  }

  if (action.type === 'navigate' && action.targetUrl) {
    return `Navigate to ${new URL(action.targetUrl).pathname}`;
  }

  // Fallback to generic description
  return `Step ${index}: ${actionVerb} action`;
}

/**
 * Deduplicate consecutive actions on the same target
 * Keeps only the last input/type action for each target
 */
function deduplicateActions(actions: CapturedAction[]): CapturedAction[] {
  const result: CapturedAction[] = [];

  for (let i = 0; i < actions.length; i++) {
    const current = actions[i];
    if (!current) continue;

    const next = actions[i + 1];

    // If this is an input action and the next one is also input on the same target,
    // skip this one and keep the later one (which has the more complete value)
    if (current.type === 'input' && next?.type === 'input') {
      // Check if same target by comparing hints
      const currentName = current.hints.find(h => h.type === 'name')?.value;
      const nextName = next.hints.find(h => h.type === 'name')?.value;

      if (currentName && currentName === nextName) {
        // Skip this action, the next one will have more complete value
        continue;
      }
    }

    // Also skip click immediately followed by type on same element (redundant)
    if (current.type === 'click' && next?.type === 'input') {
      const currentName = current.hints.find(h => h.type === 'name')?.value;
      const nextName = next.hints.find(h => h.type === 'name')?.value;

      if (currentName && currentName === nextName) {
        // Skip the click, the type action is sufficient
        continue;
      }
    }

    result.push(current);
  }

  return result;
}

/**
 * Generate basic BSL script from captured actions without LLM
 *
 * This fallback generator:
 * - Maps action types to BSL actions
 * - Uses top 3 hints from captured actions
 * - Creates basic intent descriptions
 * - Deduplicates consecutive actions on same target
 * - Produces valid YAML output
 *
 * @param actions - Array of captured user actions
 * @param startUrl - Optional URL to navigate to at script start
 * @returns Valid BSL YAML string
 */
export function generateBasicBSL(actions: CapturedAction[], startUrl?: string): string {
  // Deduplicate consecutive actions on same target
  const dedupedActions = deduplicateActions(actions);

  const steps: BSLStep[] = [];

  // Prepend navigate to startUrl if provided
  if (startUrl) {
    steps.push({
      action: 'navigate',
      url: startUrl,
    });
  }

  // Then add deduplicated action steps
  const actionSteps: BSLStep[] = dedupedActions.map((action, index) => {
    const stepIndex = index + 1;
    const bslAction = mapActionType(action.type);

    // Handle navigate action specially (no target, just URL)
    if (action.type === 'navigate') {
      return {
        action: bslAction,
        url: action.targetUrl,
      };
    }

    // Handle screenshot action specially (no target needed)
    if (action.type === 'screenshot') {
      return {
        action: 'screenshot',
      };
    }

    // Build step with target for click/input/submit actions
    const step: BSLStep = {
      action: bslAction,
      target: {
        intent: generateIntent(action, stepIndex),
        hints: action.hints.slice(0, 3), // Top 3 hints for resilience
      },
    };

    // Add fallback_selector if available (especially useful for links with href)
    if (action.fallbackSelector && step.target) {
      step.target.fallback_selector = action.fallbackSelector;
    }

    // Add value for input/type actions (but not masked passwords)
    if (action.value && action.value !== '[MASKED]') {
      step.value = action.value;
    }

    return step;
  });

  steps.push(...actionSteps);

  const script: BSLScript = {
    name: 'Recorded Script',
    version: '1.0.0',
    description: 'Auto-generated from recording (basic mode)',
    steps,
  };

  return yaml.dump(script, {
    indent: 2,
    lineWidth: -1, // No line wrapping
    noRefs: true,  // Don't use YAML references
    quotingType: '"',
    forceQuotes: false,
  });
}
