/**
 * RepairEngine - Orchestrates auto-repair when cascade resolution fails
 *
 * Takes a RepairContext (failed step info + DOM excerpt), builds a
 * hint_repairer micro-prompt, calls the LLM via routeMicroPrompt,
 * and returns ranked RepairSuggestions with confidence scores.
 *
 * Never throws -- returns empty suggestions on failure so the caller
 * can decide what to do.
 *
 * Phase 30 - Plan 30-01
 */

import type { Page } from 'playwright';
import type { LLMProvider } from '../llm/providers/types.js';
import type { MicroPromptInput, HintRepairerOutput } from '@browserlet/core/prompts';
import { routeMicroPrompt } from '../llm/microPromptRouter.js';
import type { RepairContext, RepairResult, RepairSuggestion } from './types.js';

export class RepairEngine {
  private page: Page;
  private provider: LLMProvider;

  constructor(page: Page, provider: LLMProvider) {
    this.page = page;
    this.provider = provider;
  }

  /**
   * Attempt to repair a failed step by asking the LLM for alternative hints.
   *
   * @param context - The repair context containing failure info and DOM excerpt
   * @returns RepairResult with suggestions sorted by confidence (descending), never throws
   */
  async attemptRepair(context: RepairContext): Promise<RepairResult> {
    const emptyResult: RepairResult = {
      stepIndex: context.stepIndex,
      originalHints: context.step.target?.hints ?? [],
      suggestions: [],
      applied: false,
    };

    try {
      console.log(
        `[RepairEngine] Attempting repair for step ${context.stepIndex + 1} ` +
        `(action: ${context.step.action}, hints: ${emptyResult.originalHints.length})`
      );

      // Build micro-prompt input from RepairContext
      const repairerInput: MicroPromptInput = {
        type: 'hint_repairer',
        data: {
          original_hints: context.step.target?.hints ?? [],
          failed_hints: context.failedHints,
          matched_hints: context.matchedHints,
          dom_excerpt: context.domExcerpt,
          page_url: context.pageUrl,
          action_type: context.step.action,
          step_intent: context.step.target?.intent,
        },
      };

      // Call routeMicroPrompt with hint_repairer type
      const result = await routeMicroPrompt(this.provider, {
        promptType: 'hint_repairer',
        input: repairerInput,
      });

      // Handle failure
      if (result.success === false) {
        console.log(
          `[RepairEngine] LLM repair failed: ${result.code} - ${result.error}`
        );
        return emptyResult;
      }

      // Extract HintRepairerOutput from validated result
      const output = result.output.data as HintRepairerOutput;

      // Build RepairSuggestion from LLM output
      const suggestion: RepairSuggestion = {
        hints: output.suggested_hints,
        confidence: output.confidence,
        reasoning: output.reasoning,
      };

      console.log(
        `[RepairEngine] Repair suggestion: confidence=${suggestion.confidence.toFixed(2)}, ` +
        `hints=${suggestion.hints.length}`
      );

      // Sort suggestions by confidence descending (single suggestion now, future multi-support)
      const suggestions = [suggestion].sort((a, b) => b.confidence - a.confidence);

      return {
        stepIndex: context.stepIndex,
        originalHints: context.step.target?.hints ?? [],
        suggestions,
        applied: false, // Plan 30-02 handles application
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`[RepairEngine] Unexpected error during repair: ${msg}`);
      return emptyResult;
    }
  }
}
