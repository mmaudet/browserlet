/**
 * Resolver bundle entry point for esbuild
 *
 * This file is the esbuild entryPoint. It imports all resolver modules
 * and exposes them on globalThis.__browserletResolver for page.evaluate() access.
 *
 * Usage in CLI: page.evaluate(RESOLVER_BUNDLE) injects this IIFE,
 * then page.evaluate(() => window.__browserletResolver.resolveElementCascade(hints))
 */

import { resolveElementCascade, waitForElementCascade } from './cascadeResolver';
import type { CascadeResolverResult } from './cascadeResolver';
import { resolveElement, isElementInteractable } from './semanticResolver';
import { extractDOMContext } from './domContextExtractor';
import { computeStructuralBoost } from './structuralScorer';
import { HINT_WEIGHTS } from './types';

// Expose resolver functions on globalThis for page.evaluate() access
(globalThis as any).__browserletResolver = {
  resolveElementCascade,
  waitForElementCascade,
  resolveElement,
  isElementInteractable,
  extractDOMContext,
  computeStructuralBoost,
  HINT_WEIGHTS,
};

// Re-export types for consumers (stripped at bundle time, but useful for TS references)
export type { CascadeResolverResult };
