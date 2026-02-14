/**
 * Micro-prompt templates for targeted LLM calls during element resolution
 * Re-export shim: forwards to @browserlet/core/prompts
 */

// Re-export from shared package
export {
  buildMicroPrompt,
  validateMicroPromptOutput,
  validateHintSuggesterOutput,
  validateDisambiguatorOutput,
  validateConfidenceBoosterOutput,
  MICRO_PROMPT_BUDGETS,
} from '@browserlet/core/prompts';
export type {
  MicroPromptType,
  MicroPromptInput,
  MicroPromptOutput,
  HintSuggesterInput,
  HintSuggesterOutput,
  DisambiguatorInput,
  DisambiguatorOutput,
  ConfidenceBoosterInput,
  ConfidenceBoosterOutput,
} from '@browserlet/core/prompts';
