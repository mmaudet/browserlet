/**
 * CascadeResolver - Multi-stage cascade resolver for enriched element resolution
 *
 * Orchestrates Stages 1-5 to achieve high resolution rates: 85% deterministic (Stages 1-2),
 * 15% micro-prompt assisted (Stages 3-5), with CSS fallback (Stage 6) in PlaybackManager.
 *
 * Stage 1: Reuses existing semanticResolver with raised threshold (0.85 + high-weight hint)
 * Stage 2: Applies DOMContextExtractor + StructuralScorer for structural disambiguation
 * Stage 3: hint_suggester micro-prompt (zero candidates -- suggests alternative hints)
 * Stage 4: disambiguator micro-prompt (2+ candidates >= 0.70 -- selects correct one)
 * Stage 5: confidence_booster micro-prompt (1 candidate 0.50-0.69 -- confirms or rejects)
 * Stage 6 (CSS fallback): Handled by PlaybackManager
 *
 * Returns CascadeResolverResult extending ResolverResult for backward compatibility (RSLV-09).
 */

import type { SemanticHint, HintType } from '@browserlet/core/types';
import { HINT_WEIGHTS } from '@browserlet/core/types';
import type { ResolverResult } from './types';
import { resolveElement, isElementInteractable } from './semanticResolver';
import { extractDOMContext } from './domContextExtractor';
import type { DOMContext } from './domContextExtractor';
import { computeStructuralBoost } from './structuralScorer';
import type { StructuralBoost } from './structuralScorer';
import { HintStabilityTracker } from './hintStabilityTracker';
import { normalizeText } from '../../../utils/hints/text';
import type {
  MicroPromptInput,
  HintSuggesterInput,
  DisambiguatorInput,
  ConfidenceBoosterInput,
  HintSuggesterOutput,
  DisambiguatorOutput,
  ConfidenceBoosterOutput,
} from '../../background/llm/microPromptBuilder';

/** Stage 1 confidence threshold -- raised from 0.70 per 18-ANALYSIS.md */
const STAGE_1_CONFIDENCE = 0.85;

/** Stage 2 confidence threshold after structural boosts */
const STAGE_2_CONFIDENCE = 0.70;

/** Minimum weight for "high-weight hint" requirement in Stage 1 */
const HIGH_WEIGHT_THRESHOLD = 0.9;

/** Max confidence gap from best candidate for Stage 2 competitor inclusion */
const STAGE_2_COMPETITOR_GAP = 0.20;

/** Extended result from cascade resolution */
export interface CascadeResolverResult extends ResolverResult {
  /** Which cascade stage resolved the element (1 = deterministic, 2 = enriched, 3 = hint_suggester, 4 = disambiguator, 5 = confidence_booster, 6 = fallback CSS) */
  stage: number;
  /** Structural boost details (only for Stage 2) */
  structuralBoost?: StructuralBoost;
  /** Stability boost applied (only if stability data exists) */
  stabilityBoost?: number;
  /** Performance: resolution time in milliseconds */
  resolutionTimeMs: number;
}

/**
 * Check if a Stage 1 result has at least one high-weight matched hint.
 * High-weight means the hint type has weight >= HIGH_WEIGHT_THRESHOLD (0.9).
 */
function hasHighWeightMatch(matchedHints: string[], hints: SemanticHint[]): boolean {
  // matchedHints format: "type:value" or "type:name=value"
  const matchedTypes = new Set<string>();
  for (const matched of matchedHints) {
    const colonIndex = matched.indexOf(':');
    if (colonIndex > 0) {
      matchedTypes.add(matched.substring(0, colonIndex));
    }
  }

  // Check if any matched type has weight >= threshold
  for (const type of matchedTypes) {
    const weight = HINT_WEIGHTS[type as HintType];
    if (weight !== undefined && weight >= HIGH_WEIGHT_THRESHOLD) {
      return true;
    }
  }

  return false;
}

/**
 * Gather competing candidates for Stage 2 by querying for elements matching
 * at least one high-weight hint. When no high-weight hints exist, falls back
 * to text_contains and class_contains hints to find candidates via DOM scan.
 */
function gatherCompetitors(
  hints: SemanticHint[],
  bestConfidence: number
): Array<{ element: Element; confidence: number; matchedHints: string[]; failedHints: string[] }> {
  // Get high-weight hints to query by
  const highWeightHints = hints.filter(h => {
    const weight = HINT_WEIGHTS[h.type];
    return weight !== undefined && weight >= HIGH_WEIGHT_THRESHOLD;
  });

  // Query candidates using high-weight hints (bounded queries)
  const candidateSet = new Set<Element>();
  for (const hint of highWeightHints) {
    if (typeof hint.value !== 'string') continue;

    let elements: Element[] = [];
    switch (hint.type) {
      case 'role':
        elements = Array.from(document.querySelectorAll(`[role="${hint.value}"]`));
        break;
      case 'type':
        elements = Array.from(document.querySelectorAll(`[type="${hint.value}"]`));
        break;
      case 'name':
        elements = Array.from(document.querySelectorAll(`[name="${hint.value}"]`));
        break;
      case 'id': {
        const el = document.getElementById(hint.value);
        if (el) elements = [el];
        break;
      }
      case 'aria_label':
        elements = Array.from(document.querySelectorAll(`[aria-label="${hint.value}"]`));
        break;
      case 'data_attribute':
        // data_attribute has object value, handled separately
        break;
    }

    for (const el of elements) {
      // Only include visible elements
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        candidateSet.add(el);
      }
    }
  }

  // Fallback: when no high-weight hints produced candidates, use text_contains
  // and class_contains to scan the DOM (handles non-semantic clickable elements)
  if (candidateSet.size === 0) {
    const textHint = hints.find(h => h.type === 'text_contains' && typeof h.value === 'string');
    const classHint = hints.find(h => h.type === 'class_contains' && typeof h.value === 'string');

    if (textHint && typeof textHint.value === 'string') {
      const needle = normalizeText(textHint.value);
      // Scan clickable containers and text elements
      const potentials = document.querySelectorAll(
        'a, button, div, span, li, td, article, section, [tabindex], [onclick], [role]'
      );
      for (const el of potentials) {
        const text = normalizeText(el.textContent);
        if (text.includes(needle)) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            // If class_contains hint also present, filter by it
            if (classHint && typeof classHint.value === 'string') {
              if (el.classList.contains(classHint.value)) {
                candidateSet.add(el);
              }
            } else {
              candidateSet.add(el);
            }
          }
        }
      }
    }
  }

  // Score each candidate against all hints
  const maxPossibleScore = hints.reduce((sum, hint) => sum + HINT_WEIGHTS[hint.type], 0);
  if (maxPossibleScore === 0) return [];

  const results: Array<{ element: Element; confidence: number; matchedHints: string[]; failedHints: string[] }> = [];

  for (const candidate of candidateSet) {
    let score = 0;
    const matchedHints: string[] = [];
    const failedHints: string[] = [];

    for (const hint of hints) {
      const hintDescription = typeof hint.value === 'string'
        ? `${hint.type}:${hint.value}`
        : `${hint.type}:${hint.value.name}=${hint.value.value}`;

      if (matchHintSimple(candidate, hint)) {
        score += HINT_WEIGHTS[hint.type];
        matchedHints.push(hintDescription);
      } else {
        failedHints.push(hintDescription);
      }
    }

    const confidence = score / maxPossibleScore;

    // Only include competitors within the confidence gap of the best
    if (confidence >= bestConfidence - STAGE_2_COMPETITOR_GAP) {
      results.push({ element: candidate, confidence, matchedHints, failedHints });
    }
  }

  return results;
}

/**
 * Simplified hint matching for Stage 2 competitor scoring.
 * Mirrors matchHint from semanticResolver but uses basic comparison.
 */
function matchHintSimple(element: Element, hint: SemanticHint): boolean {
  if (typeof hint.value === 'string') {
    const value = hint.value;
    switch (hint.type) {
      case 'role': {
        const explicitRole = element.getAttribute('role');
        if (explicitRole === value) return true;
        // Check implicit roles for common cases
        const tag = element.tagName.toLowerCase();
        if (tag === 'input') {
          const inputType = (element as HTMLInputElement).type || 'text';
          const implicitRoles: Record<string, string> = {
            'button': 'button', 'submit': 'button', 'reset': 'button',
            'checkbox': 'checkbox', 'radio': 'radio', 'range': 'slider',
            'search': 'searchbox', 'email': 'textbox', 'tel': 'textbox',
            'url': 'textbox', 'number': 'spinbutton', 'text': 'textbox',
          };
          return implicitRoles[inputType] === value;
        }
        const tagRoles: Record<string, string> = {
          'a': 'link', 'button': 'button', 'select': 'combobox', 'textarea': 'textbox',
          'nav': 'navigation', 'main': 'main', 'header': 'banner', 'footer': 'contentinfo',
        };
        return tagRoles[tag] === value;
      }
      case 'id':
        return element.id === value;
      case 'type':
        return element.getAttribute('type') === value;
      case 'name':
        return element.getAttribute('name') === value;
      case 'aria_label':
        return element.getAttribute('aria-label') === value;
      case 'text_contains': {
        const text = normalizeText(element.textContent);
        return text.includes(normalizeText(value));
      }
      case 'placeholder_contains': {
        const placeholder = element.getAttribute('placeholder') || '';
        return normalizeText(placeholder).includes(normalizeText(value));
      }
      case 'near_label':
        // Skip for simple matching -- too expensive without existing utility
        return false;
      case 'class_contains':
        return element.classList.contains(value);
    }
  } else if (hint.type === 'data_attribute') {
    const { name, value: attrValue } = hint.value as { name: string; value: string };
    return element.getAttribute(name) === attrValue;
  }
  return false;
}

/**
 * Send a micro-prompt request to the background service worker via messaging.
 * Returns the typed response data or null on any failure.
 * Graceful degradation: LLM unavailable, timeout, invalid response all return null.
 */
async function sendMicroPrompt<T>(input: MicroPromptInput): Promise<T | null> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'MICRO_PROMPT_REQUEST',
      payload: {
        promptType: input.type,
        input,
      },
    });

    if (response?.success && response.data?.success && response.data.output) {
      return response.data.output.data as T;
    }

    // Log failure reason for debugging but don't throw
    const errorMsg = response?.data?.error || response?.error || 'Unknown micro-prompt failure';
    console.warn(`[CascadeResolver] Micro-prompt ${input.type} failed: ${errorMsg}`);
    return null;
  } catch (error) {
    // Extension context invalidated, messaging failure, etc.
    console.warn(`[CascadeResolver] Micro-prompt ${input.type} messaging error:`, error);
    return null;
  }
}

/**
 * Check if micro-prompts are enabled via stored LLM config.
 * Reads from chrome.storage.local. Returns true by default (MPRT-06).
 */
async function getMicroPromptsEnabled(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get('browserlet_llm_config');
    const config = stored.browserlet_llm_config;
    if (config && typeof config === 'object' && 'useMicroPrompts' in config) {
      return config.useMicroPrompts !== false;
    }
    return true; // Default: enabled
  } catch {
    return true; // Default: enabled on storage error
  }
}

/**
 * Format DOMContext into a short structural_context string for micro-prompt inputs.
 * Example: "inside fieldset 'Billing', label 'Email', in navigation landmark"
 */
function formatDOMContextString(ctx: DOMContext): string {
  const parts: string[] = [];
  if (ctx.fieldset_legend) parts.push(`inside fieldset '${ctx.fieldset_legend}'`);
  if (ctx.associated_label) parts.push(`label '${ctx.associated_label}'`);
  if (ctx.near_label) parts.push(`near '${ctx.near_label.text}'`);
  if (ctx.landmark) parts.push(`in ${ctx.landmark} landmark`);
  if (ctx.section_heading) parts.push(`under heading '${ctx.section_heading}'`);
  return parts.join(', ') || 'no structural context';
}

/**
 * Get a DOM excerpt around the expected area for hint_suggester.
 * Uses the page body's first 500 chars of visible text as a rough excerpt.
 * This is a best-effort heuristic since we have no candidates to anchor on.
 */
function getDOMExcerpt(): string {
  // Try to get a meaningful excerpt from the main content area
  const main = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
  const excerpt = main.innerHTML.slice(0, 500);
  return excerpt;
}

/**
 * Main cascade resolution function.
 * Stage 1: Deterministic hint matching (confidence >= 0.85 + high-weight hint)
 * Stage 2: Enriched structural matching (confidence >= 0.70 after boosts)
 * Stage 3: hint_suggester micro-prompt (zero candidates after Stage 2)
 * Stage 4: disambiguator micro-prompt (2+ candidates >= 0.70)
 * Stage 5: confidence_booster micro-prompt (1 candidate 0.50-0.69)
 * Stage 6 (CSS fallback): Handled by PlaybackManager
 */
export async function resolveElementCascade(
  hints: SemanticHint[],
  _retryDepth: number = 0
): Promise<CascadeResolverResult> {
  const startTime = performance.now();

  if (hints.length === 0) {
    return {
      element: null,
      confidence: 0,
      matchedHints: [],
      failedHints: [],
      stage: 1,
      resolutionTimeMs: performance.now() - startTime,
    };
  }

  // Initialize stability tracker (caches per hostname)
  const tracker = new HintStabilityTracker();
  await tracker.load();
  const stabilityBoost = tracker.getStabilityBoost(hints);

  // --- Stage 1: Deterministic hint matching ---
  const stage1Result = resolveElement(hints);
  const stage1Confidence = Math.min(stage1Result.confidence + stabilityBoost, 1.0);

  if (
    stage1Result.element &&
    stage1Confidence >= STAGE_1_CONFIDENCE &&
    hasHighWeightMatch(stage1Result.matchedHints, hints)
  ) {
    const result: CascadeResolverResult = {
      ...stage1Result,
      confidence: stage1Confidence,
      stage: 1,
      stabilityBoost: stabilityBoost > 0 ? stabilityBoost : undefined,
      resolutionTimeMs: performance.now() - startTime,
    };

    // Record success asynchronously (fire-and-forget)
    tracker.recordSuccess(hints, stage1Result.matchedHints).catch(() => {});

    return result;
  }

  // --- Stage 2: Enriched structural matching ---
  // Gather competing candidates near the best score
  const competitors = gatherCompetitors(hints, stage1Result.confidence);

  // Also include the Stage 1 best candidate if it found one
  if (stage1Result.element) {
    const alreadyIncluded = competitors.some(c => c.element === stage1Result.element);
    if (!alreadyIncluded) {
      competitors.push({
        element: stage1Result.element,
        confidence: stage1Result.confidence,
        matchedHints: stage1Result.matchedHints,
        failedHints: stage1Result.failedHints,
      });
    }
  }

  if (competitors.length === 0) {
    // --- Stage 3: hint_suggester (MPRT-01) ---
    // Zero candidates -- ask LLM for alternative hints
    const zeroMicroPromptsEnabled = await getMicroPromptsEnabled();
    if (zeroMicroPromptsEnabled && _retryDepth === 0) {
      // Pre-check: skip LLM call if hints reference form input elements but the page has none.
      // This prevents wasting tokens when the page has navigated away (e.g. SSO → dashboard).
      // Only check hint types that are strongly form-input-specific (not id/role which are generic).
      const formInputHintTypes = new Set(['placeholder_contains']);
      const formInputTypeValues = new Set(['text', 'password', 'email', 'tel', 'number', 'search', 'url']);
      const hintsReferenceFormElement = hints.some(h =>
        formInputHintTypes.has(h.type) ||
        (h.type === 'type' && typeof h.value === 'string' && formInputTypeValues.has(h.value))
      );
      const pageHasFormElements = document.querySelectorAll('input, select, textarea').length > 0;

      if (hintsReferenceFormElement && !pageHasFormElements) {
        console.log('[CascadeResolver] Stage 3: skipping hint_suggester — hints reference form elements but page has none (likely wrong page)');
      } else {
        console.log('[CascadeResolver] Stage 3: hint_suggester (zero candidates)');

        const hintSuggesterInput: MicroPromptInput = {
          type: 'hint_suggester',
          data: {
            original_hints: hints,
            dom_excerpt: getDOMExcerpt(),
            page_url: window.location.href,
            action_type: 'click', // Default; caller doesn't pass action type currently
          } satisfies HintSuggesterInput,
        };

        const suggestion = await sendMicroPrompt<HintSuggesterOutput>(hintSuggesterInput);
        if (suggestion && suggestion.suggested_hints.length > 0) {
          console.log('[CascadeResolver] Stage 3: retrying with', suggestion.suggested_hints.length, 'suggested hints');
          // Retry Stage 1 + 2 with LLM-suggested hints
          const retryResult = await resolveElementCascade(suggestion.suggested_hints, _retryDepth + 1);
          if (retryResult.element && retryResult.confidence >= STAGE_2_CONFIDENCE) {
            return {
              ...retryResult,
              stage: 3,
              resolutionTimeMs: performance.now() - startTime,
            };
          }
        }
      }
    }

    // No resolution -- return failure
    const result: CascadeResolverResult = {
      ...stage1Result,
      stage: zeroMicroPromptsEnabled ? 3 : 2,
      resolutionTimeMs: performance.now() - startTime,
    };
    tracker.recordFailure(hints).catch(() => {});
    return result;
  }

  // Apply structural scoring to each competitor
  let bestCandidate: {
    element: Element;
    adjustedConfidence: number;
    matchedHints: string[];
    failedHints: string[];
    structuralBoost: StructuralBoost;
  } | null = null;

  for (const candidate of competitors) {
    const domContext = extractDOMContext(candidate.element);
    const structuralBoost = computeStructuralBoost(domContext, hints);

    const adjustedConfidence = Math.min(
      candidate.confidence + structuralBoost.total + stabilityBoost,
      1.0
    );

    if (!bestCandidate || adjustedConfidence > bestCandidate.adjustedConfidence) {
      bestCandidate = {
        element: candidate.element,
        adjustedConfidence,
        matchedHints: candidate.matchedHints,
        failedHints: candidate.failedHints,
        structuralBoost,
      };
    }
  }

  if (bestCandidate && bestCandidate.adjustedConfidence >= STAGE_2_CONFIDENCE) {
    const result: CascadeResolverResult = {
      element: bestCandidate.element,
      confidence: bestCandidate.adjustedConfidence,
      matchedHints: bestCandidate.matchedHints,
      failedHints: bestCandidate.failedHints,
      stage: 2,
      structuralBoost: bestCandidate.structuralBoost,
      stabilityBoost: stabilityBoost > 0 ? stabilityBoost : undefined,
      resolutionTimeMs: performance.now() - startTime,
    };

    // Record success asynchronously
    tracker.recordSuccess(hints, bestCandidate.matchedHints).catch(() => {});

    return result;
  }

  // --- Stages 4-5: disambiguator or confidence_booster ---
  const microPromptsEnabled = await getMicroPromptsEnabled();

  if (microPromptsEnabled && competitors.length >= 2) {
    // Check how many competitors score >= 0.70 (with structural boosts)
    const highScorers = competitors.filter(c => {
      const ctx = extractDOMContext(c.element);
      const boost = computeStructuralBoost(ctx, hints);
      return (c.confidence + boost.total + stabilityBoost) >= STAGE_2_CONFIDENCE;
    });

    if (highScorers.length >= 2) {
      // --- Stage 4: disambiguator (MPRT-02) ---
      console.log('[CascadeResolver] Stage 4: disambiguator (' + highScorers.length + ' candidates >= 0.70)');

      const candidateInfos = highScorers.slice(0, 5).map((c, idx) => {
        const ctx = extractDOMContext(c.element);
        const el = c.element;
        const attrs: Record<string, string> = {};
        for (const attr of el.attributes) {
          if (['id', 'name', 'type', 'role', 'class', 'aria-label', 'placeholder', 'href'].includes(attr.name)) {
            attrs[attr.name] = attr.value;
          }
        }
        return {
          index: idx,
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 50),
          attributes: attrs,
          structural_context: formatDOMContextString(ctx),
        };
      });

      const disambiguatorInput: MicroPromptInput = {
        type: 'disambiguator',
        data: {
          candidates: candidateInfos,
          original_hints: hints,
          action_type: 'click',
        } satisfies DisambiguatorInput,
      };

      const disambiguation = await sendMicroPrompt<DisambiguatorOutput>(disambiguatorInput);
      if (disambiguation && disambiguation.selected_index >= 0 && disambiguation.selected_index < highScorers.length) {
        const selected = highScorers[disambiguation.selected_index]!;
        const selectedCtx = extractDOMContext(selected.element);
        const selectedBoost = computeStructuralBoost(selectedCtx, hints);

        console.log('[CascadeResolver] Stage 4: disambiguator selected index', disambiguation.selected_index, 'confidence:', disambiguation.confidence);

        const result: CascadeResolverResult = {
          element: selected.element,
          confidence: Math.min(selected.confidence + selectedBoost.total + stabilityBoost, 1.0),
          matchedHints: selected.matchedHints,
          failedHints: selected.failedHints,
          stage: 4,
          structuralBoost: selectedBoost,
          stabilityBoost: stabilityBoost > 0 ? stabilityBoost : undefined,
          resolutionTimeMs: performance.now() - startTime,
        };
        tracker.recordSuccess(hints, selected.matchedHints).catch(() => {});
        return result;
      }
    }
  }

  if (microPromptsEnabled && bestCandidate) {
    const candidateConfidence = bestCandidate.adjustedConfidence;

    if (candidateConfidence >= 0.50 && candidateConfidence < STAGE_2_CONFIDENCE) {
      // --- Stage 5: confidence_booster (MPRT-03) ---
      console.log('[CascadeResolver] Stage 5: confidence_booster (confidence:', candidateConfidence.toFixed(2), ')');

      const el = bestCandidate.element;
      const ctx = extractDOMContext(el);
      const attrs: Record<string, string> = {};
      for (const attr of el.attributes) {
        if (['id', 'name', 'type', 'role', 'class', 'aria-label', 'placeholder', 'href'].includes(attr.name)) {
          attrs[attr.name] = attr.value;
        }
      }

      const boosterInput: MicroPromptInput = {
        type: 'confidence_booster',
        data: {
          candidate: {
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || '').trim().slice(0, 50),
            attributes: attrs,
            structural_context: formatDOMContextString(ctx),
          },
          original_hints: hints,
          matched_hints: bestCandidate.matchedHints,
          failed_hints: bestCandidate.failedHints,
          confidence: candidateConfidence,
        } satisfies ConfidenceBoosterInput,
      };

      const boost = await sendMicroPrompt<ConfidenceBoosterOutput>(boosterInput);
      if (boost && boost.is_correct) {
        console.log('[CascadeResolver] Stage 5: confidence_booster confirmed element');
        const result: CascadeResolverResult = {
          element: bestCandidate.element,
          confidence: Math.min(candidateConfidence + 0.20, 1.0), // Boost confidence by 0.20 on LLM confirmation
          matchedHints: bestCandidate.matchedHints,
          failedHints: bestCandidate.failedHints,
          stage: 5,
          structuralBoost: bestCandidate.structuralBoost,
          stabilityBoost: stabilityBoost > 0 ? stabilityBoost : undefined,
          resolutionTimeMs: performance.now() - startTime,
        };
        tracker.recordSuccess(hints, bestCandidate.matchedHints).catch(() => {});
        return result;
      } else if (boost && !boost.is_correct) {
        console.log('[CascadeResolver] Stage 5: confidence_booster rejected element');
        // LLM says this is wrong -- don't return it, fall through to failure
      }
    }
  }

  // No resolution above threshold -- fall through to Stage 6 (CSS fallback in PlaybackManager)
  const failResult: CascadeResolverResult = {
    element: bestCandidate?.element ?? null,
    confidence: bestCandidate?.adjustedConfidence ?? stage1Result.confidence,
    matchedHints: bestCandidate?.matchedHints ?? stage1Result.matchedHints,
    failedHints: bestCandidate?.failedHints ?? stage1Result.failedHints,
    stage: microPromptsEnabled ? 5 : 2,
    structuralBoost: bestCandidate?.structuralBoost,
    stabilityBoost: stabilityBoost > 0 ? stabilityBoost : undefined,
    resolutionTimeMs: performance.now() - startTime,
  };

  tracker.recordFailure(hints).catch(() => {});
  return failResult;
}

/**
 * Wait for an element to appear and become interactable using cascade resolution.
 * Mirrors waitForElement() but uses resolveElementCascade internally.
 *
 * @param hints - Semantic hints to match
 * @param timeoutMs - Maximum wait time (default 10s)
 */
export function waitForElementCascade(
  hints: SemanticHint[],
  timeoutMs: number = 10000
): Promise<CascadeResolverResult> {
  return new Promise((resolve, reject) => {
    const overallStart = performance.now();

    // Try immediate resolution first
    resolveElementCascade(hints).then(immediateResult => {
      if (immediateResult.element && isElementInteractable(immediateResult.element)) {
        resolve(immediateResult);
        return;
      }

      // Set up MutationObserver for DOM changes
      let observer: MutationObserver | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let resolving = false; // Prevent concurrent resolution attempts

      const cleanup = () => {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      const checkElement = () => {
        if (resolving) return; // Skip if already resolving
        resolving = true;

        resolveElementCascade(hints).then(result => {
          resolving = false;
          if (result.element && isElementInteractable(result.element)) {
            cleanup();
            // Update resolution time to include wait time
            result.resolutionTimeMs = performance.now() - overallStart;
            resolve(result);
          }
        }).catch(() => {
          resolving = false;
        });
      };

      // Set up MutationObserver
      observer = new MutationObserver(() => {
        checkElement();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'disabled', 'aria-disabled'],
      });

      // Set up timeout fallback
      timeoutId = setTimeout(() => {
        cleanup();

        const hintsDebug = hints.map(h =>
          typeof h.value === 'string'
            ? `${h.type}:${h.value}`
            : `${h.type}:${h.value.name}=${h.value.value}`
        ).join(', ');

        reject(new Error(
          `waitForElementCascade timeout after ${timeoutMs}ms. ` +
          `Could not find interactable element matching hints: [${hintsDebug}]`
        ));
      }, timeoutMs);
    }).catch(reject);
  });
}
