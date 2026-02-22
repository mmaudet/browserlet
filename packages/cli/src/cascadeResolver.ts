/**
 * CascadeCLIResolver - Cascade resolver adapter for Playwright CLI execution
 *
 * Injects the resolver bundle (IIFE) into Playwright page context via
 * page.addInitScript (persists across navigations) and page.evaluate
 * (immediate availability). Resolves elements via page.evaluate() calling
 * window.__browserletResolver.waitForElementCascade(), then bridges the
 * result back to a Playwright-compatible selector using a data-attribute
 * marking pattern.
 *
 * The data-browserlet-resolved attribute is set on the matched element inside
 * page.evaluate, and the attribute selector is returned for Playwright actions.
 */

import type { Page } from 'playwright';
import type { BSLStep } from '@browserlet/core/types';
import type { FailureDiagnostic, CandidateScoringRow } from '@browserlet/core/types';
import { RESOLVER_BUNDLE } from './resolverBundleCode.js';

/** Error thrown by CascadeCLIResolver when cascade resolution fails, carrying structured diagnostic */
export class DiagnosticError extends Error {
  constructor(
    message: string,
    public readonly diagnostic: FailureDiagnostic,
  ) {
    super(message);
    this.name = 'DiagnosticError';
  }
}

/** Actions that do not require selector resolution */
const NO_SELECTOR_ACTIONS = new Set(['navigate', 'screenshot']);

/** Reduced timeout for Phase 3 when Phase 1 found zero candidates */
const ZERO_CANDIDATE_TIMEOUT = 3000;

/** Partial diagnostic data from the in-browser resolver (no stepId/pageUrl) */
interface PartialDiagnosticData {
  failedAtStage: number;
  confidenceThreshold: number;
  bestCandidateScore: number | null;
  confidenceGap: number | null;
  topCandidates: CandidateScoringRow[];
}

/**
 * Result returned from page.evaluate when cascade resolution succeeds.
 * Contains the attribute selector string and diagnostic info.
 */
interface CascadeEvalResult {
  selector: string;
  confidence: number;
  stage: number;
  matchedHints: string[];
  failedHints: string[];
  diagnostic?: PartialDiagnosticData;
}

/**
 * CascadeCLIResolver injects the full cascade resolver bundle into the
 * Playwright page and resolves elements using semantic hints with
 * deterministic multi-stage scoring.
 *
 * When cascade resolution fails (confidence < 0.70), it throws an error
 * with diagnostic info so BSLRunner can fall back to SimpleResolver.
 */
export class CascadeCLIResolver {
  private page: Page;
  private timeout: number;
  private injected = false;

  constructor(page: Page, timeout: number = 10000) {
    this.page = page;
    this.timeout = timeout;
  }

  /**
   * Inject the resolver bundle into the page context.
   *
   * - addInitScript registers the bundle for all FUTURE navigations
   * - page.evaluate runs the bundle immediately for the CURRENT page
   *
   * Safe to call multiple times (idempotent via injected flag).
   */
  async inject(): Promise<void> {
    if (this.injected) return;

    // Register for future navigations (persists across page.goto)
    await this.page.addInitScript({ content: RESOLVER_BUNDLE });

    // Make available immediately on current page
    await this.page.evaluate(RESOLVER_BUNDLE);

    this.injected = true;
  }

  /**
   * Resolve a BSL step target to a Playwright-compatible selector string.
   *
   * Resolution flow (3 phases):
   * Phase 1: Immediate resolveElementCascade (no MutationObserver) ~5ms
   *   → success ? return selector
   * Phase 2: Test fallback_selector via page.locator ~10ms
   *   → found ? return CSS selector directly
   * Phase 3: waitForElementCascade with MutationObserver (dynamic timeout)
   *   → timeout=3s if Phase 1 found 0 candidates, full timeout otherwise
   *
   * @param step - The BSL step to resolve
   * @returns Attribute selector string like [data-browserlet-resolved="__brl_1234_abc"]
   * @throws Error if cascade resolution fails (BSLRunner catches for fallback)
   */
  async resolve(step: BSLStep): Promise<string> {
    // No-selector actions
    if (NO_SELECTOR_ACTIONS.has(step.action) && !step.target) {
      return '';
    }

    // No target defined
    if (!step.target) {
      throw new Error(
        `CascadeCLIResolver: no target defined for step ${step.id || step.action}`,
      );
    }

    // No hints -- cannot run cascade resolution
    if (!step.target.hints || step.target.hints.length === 0) {
      throw new Error(
        `CascadeCLIResolver: no hints for step ${step.id || step.action}`,
      );
    }

    const hints = step.target.hints;

    // --- Phase 1: Immediate resolution (no MutationObserver) ---
    // Calls resolveElementCascade directly (stages 1-5 without DOM wait).
    // If element is found and interactable, marks it and returns immediately.
    const phase1Result = await this.page.evaluate(
      async ({ hints: serializedHints }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resolver = (globalThis as any).__browserletResolver;
        if (!resolver || typeof resolver.resolveElementCascade !== 'function') {
          return {
            success: false as const,
            error: 'Resolver bundle not available on page (window.__browserletResolver missing)',
            confidence: 0,
            stage: 0,
            matchedHints: [] as string[],
            failedHints: [] as string[],
            matchedCount: 0,
          };
        }

        try {
          const cascadeResult = await resolver.resolveElementCascade(serializedHints);

          if (cascadeResult.element && resolver.isElementInteractable(cascadeResult.element)) {
            const marker = `__brl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            cascadeResult.element.setAttribute('data-browserlet-resolved', marker);
            return {
              success: true as const,
              selector: `[data-browserlet-resolved="${marker}"]`,
              confidence: cascadeResult.confidence as number,
              stage: cascadeResult.stage as number,
              matchedHints: cascadeResult.matchedHints as string[],
              failedHints: cascadeResult.failedHints as string[],
              matchedCount: (cascadeResult.matchedHints as string[]).length,
            };
          }

          return {
            success: false as const,
            error: 'No interactable element found in immediate resolution',
            confidence: (cascadeResult.confidence ?? 0) as number,
            stage: (cascadeResult.stage ?? 0) as number,
            matchedHints: (cascadeResult.matchedHints ?? []) as string[],
            failedHints: (cascadeResult.failedHints ?? []) as string[],
            matchedCount: ((cascadeResult.matchedHints ?? []) as string[]).length,
            diagnostic: cascadeResult.diagnostic ?? undefined,
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            success: false as const,
            error: message,
            confidence: 0,
            stage: 0,
            matchedHints: [] as string[],
            failedHints: [] as string[],
            matchedCount: 0,
          };
        }
      },
      { hints },
    );

    if (phase1Result.success) {
      return (phase1Result as typeof phase1Result & { selector: string }).selector;
    }

    // --- Phase 2: Test fallback_selector ---
    if (step.target.fallback_selector) {
      try {
        const count = await this.page.locator(step.target.fallback_selector).count();
        if (count > 0) {
          return step.target.fallback_selector;
        }
      } catch {
        // Invalid selector or page navigation — continue to Phase 3
      }
    }

    // --- Phase 3: waitForElementCascade with MutationObserver (dynamic timeout) ---
    const effectiveTimeout = phase1Result.confidence === 0 && phase1Result.matchedCount === 0
      ? ZERO_CANDIDATE_TIMEOUT
      : this.timeout;

    const result = await this.page.evaluate(
      async ({ hints: serializedHints, timeoutMs }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resolver = (globalThis as any).__browserletResolver;
        if (!resolver || typeof resolver.waitForElementCascade !== 'function') {
          return {
            success: false as const,
            error: 'Resolver bundle not available on page (window.__browserletResolver missing)',
            confidence: 0,
            stage: 0,
            matchedHints: [] as string[],
            failedHints: [] as string[],
          };
        }

        try {
          const cascadeResult = await resolver.waitForElementCascade(
            serializedHints,
            timeoutMs,
          );

          if (cascadeResult.element) {
            const marker = `__brl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            cascadeResult.element.setAttribute('data-browserlet-resolved', marker);

            return {
              success: true as const,
              selector: `[data-browserlet-resolved="${marker}"]`,
              confidence: cascadeResult.confidence as number,
              stage: cascadeResult.stage as number,
              matchedHints: cascadeResult.matchedHints as string[],
              failedHints: cascadeResult.failedHints as string[],
            };
          }

          return {
            success: false as const,
            error: 'Cascade resolver found no matching element',
            confidence: cascadeResult.confidence as number,
            stage: cascadeResult.stage as number,
            matchedHints: cascadeResult.matchedHints as string[],
            failedHints: cascadeResult.failedHints as string[],
            diagnostic: cascadeResult.diagnostic ?? undefined,
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            success: false as const,
            error: message,
            confidence: 0,
            stage: 0,
            matchedHints: [] as string[],
            failedHints: [] as string[],
          };
        }
      },
      { hints, timeoutMs: effectiveTimeout },
    );

    if (result.success) {
      return (result as CascadeEvalResult & { success: true }).selector;
    }

    // Cascade failed -- throw DiagnosticError with structured data
    // Preserve matched=[]/failed=[] format in message for backward compatibility (RepairEngine parses it)
    const diag = [
      `stage=${result.stage}`,
      `confidence=${result.confidence.toFixed(2)}`,
      result.matchedHints.length > 0
        ? `matched=[${result.matchedHints.join(', ')}]`
        : 'matched=[]',
      result.failedHints.length > 0
        ? `failed=[${result.failedHints.join(', ')}]`
        : 'failed=[]',
    ].join(', ');

    const stepId = step.id || step.action;
    const pageUrl = this.page.url();

    throw new DiagnosticError(
      `CascadeCLIResolver failed for step ${stepId}: ${result.error} (${diag})`,
      {
        stepId,
        pageUrl,
        searchedHints: step.target.hints,
        timestamp: new Date().toISOString(),
        failedAtStage: result.diagnostic?.failedAtStage ?? result.stage,
        confidenceThreshold: 0.70,
        bestCandidateScore: result.diagnostic?.bestCandidateScore ?? (result.confidence > 0 ? result.confidence : null),
        confidenceGap: result.diagnostic?.confidenceGap ?? (result.confidence > 0 ? 0.70 - result.confidence : null),
        topCandidates: result.diagnostic?.topCandidates ?? [],
      },
    );
  }
}
