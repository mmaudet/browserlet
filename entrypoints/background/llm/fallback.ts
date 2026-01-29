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
 * Generate basic BSL script from captured actions without LLM
 *
 * This fallback generator:
 * - Maps action types to BSL actions
 * - Uses top 3 hints from captured actions
 * - Creates basic intent descriptions
 * - Produces valid YAML output
 *
 * @param actions - Array of captured user actions
 * @returns Valid BSL YAML string
 */
export function generateBasicBSL(actions: CapturedAction[]): string {
  const steps: BSLStep[] = actions.map((action, index) => {
    const stepIndex = index + 1;
    const bslAction = mapActionType(action.type);

    // Handle navigate action specially (no target, just URL)
    if (action.type === 'navigate') {
      return {
        action: bslAction,
        url: action.targetUrl,
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

    // Add value for input/type actions (but not masked passwords)
    if (action.value && action.value !== '[MASKED]') {
      step.value = action.value;
    }

    return step;
  });

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
