/**
 * PlaybackManager - Central orchestrator for BSL script execution
 * Coordinates all playback modules: parser, executor, session detector, humanizer
 * Covers requirements: EXEC-02, EXEC-06, EXEC-07
 */

// Parser utilities
import { parseSteps, parseTimeout } from '../../../utils/yaml/stepParser';

// Password utilities for credential validation
import { extractCredentialRefs } from '../../../utils/passwords/substitution';
import type { VaultState } from '../../../utils/passwords/types';
import type { StoredPassword } from '../../../utils/passwords/types';

// Variable substitution for extracted values
import { substituteVariables, hasExtractedVariables } from './variableSubstitution';

// Types
import type {
  PlaybackState,
  ExecutionResult,
  ParsedScript,
  BSLStep,
  PersistedExecutionState,
  HealingContext,
  SemanticHint,
} from './types';

// Modules
import { ActionExecutor } from './actionExecutor';
import { SessionDetector } from './sessionDetector';
import { humanizedWait, DEFAULT_CONFIG } from './humanizer';
import type { HumanizerConfig } from './humanizer';
import { waitForElement, resolveElement } from './semanticResolver';
import {
  detectHealingNeeded,
  buildHealingContext,
  getHealingAttempts,
  incrementHealingAttempts,
  resetHealingAttempts,
  maxHealingAttemptsReached,
  HEALING_CONFIDENCE_THRESHOLD,
  MAX_HEALING_ATTEMPTS,
} from './healingDetector';
import { captureScreenshot, captureFailureScreenshot } from './screenshotCapture';

/**
 * Event handler type for playback events
 */
export type PlaybackEventHandler = (event: {
  type: 'state_changed' | 'progress' | 'auth_required' | 'healing_requested' | 'error';
  state?: PlaybackState;
  step?: number;
  totalSteps?: number;
  error?: string;
  healingContext?: HealingContext;
}) => void;

/**
 * PlaybackManager orchestrates step-by-step BSL script execution
 * - Parses YAML scripts
 * - Executes steps sequentially with humanized delays
 * - Handles session detection and pauses for authentication
 * - Supports abort via AbortController
 * - Emits progress events
 */
export class PlaybackManager {
  private state: PlaybackState = 'idle';
  private currentStep = 0;
  private script: ParsedScript | null = null;
  private abortController: AbortController | null = null;
  private results: Map<string, unknown> = new Map();
  private yamlContent: string = '';

  private actionExecutor: ActionExecutor;
  private sessionDetector: SessionDetector;
  private eventHandler: PlaybackEventHandler | null = null;
  private config: HumanizerConfig;

  // Healing state
  private healingResolver: ((hints: SemanticHint[] | null) => void) | null = null;
  private pendingHealingContext: HealingContext | null = null;

  // Screenshot context
  private scriptId: string = '';
  private executionId: string = '';

  constructor(config: HumanizerConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.actionExecutor = new ActionExecutor(config);
    this.sessionDetector = new SessionDetector();
  }

  /**
   * Save execution state to storage before navigation (via service worker)
   */
  private async saveStateForNavigation(nextStep: number): Promise<void> {
    const state: PersistedExecutionState = {
      yamlContent: this.yamlContent,
      currentStep: nextStep,
      results: Object.fromEntries(this.results),
      timestamp: Date.now(),
    };
    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_EXECUTION_STATE',
        payload: state
      });
      console.log('[Browserlet] Saved execution state for navigation, resuming at step', nextStep);
    } catch (error) {
      console.error('[Browserlet] Failed to save execution state:', error);
    }
  }

  /**
   * Check for and retrieve persisted execution state (via service worker)
   */
  static async getPersistedState(): Promise<PersistedExecutionState | null> {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_EXECUTION_STATE'
      });
      if (response.success && response.data) {
        return response.data as PersistedExecutionState;
      }
      return null;
    } catch (error) {
      console.error('[Browserlet] Failed to get execution state:', error);
      return null;
    }
  }

  /**
   * Clear persisted execution state (via service worker)
   */
  static async clearPersistedState(): Promise<void> {
    try {
      await chrome.runtime.sendMessage({
        type: 'CLEAR_EXECUTION_STATE'
      });
    } catch (error) {
      console.error('[Browserlet] Failed to clear execution state:', error);
    }
  }

  /**
   * Register event handler for playback events
   */
  onEvent(handler: PlaybackEventHandler): void {
    this.eventHandler = handler;
  }

  /**
   * Get current playback state
   */
  getState(): PlaybackState {
    return this.state;
  }

  /**
   * Get current step index (0-based)
   */
  getCurrentStep(): number {
    return this.currentStep;
  }

  /**
   * Get extracted results from script execution
   */
  getResults(): Record<string, unknown> {
    return Object.fromEntries(this.results);
  }

  /**
   * Emit an event to the registered handler
   */
  private emit(event: Parameters<PlaybackEventHandler>[0]): void {
    this.eventHandler?.(event);
  }

  /**
   * Update state and emit state_changed event
   */
  private setState(newState: PlaybackState): void {
    this.state = newState;
    this.emit({ type: 'state_changed', state: newState });
  }

  /**
   * Execute a BSL script from YAML content
   * @param yamlContent - YAML string containing BSL script
   * @param options - Optional execution options (for resuming after navigation)
   * @returns Execution result with status and any errors
   */
  async execute(
    yamlContent: string,
    options?: {
      startStep?: number;
      previousResults?: Record<string, unknown>;
      scriptId?: string;
      executionId?: string;
    }
  ): Promise<ExecutionResult> {
    console.log('[Browserlet] PlaybackManager.execute() called');

    // Don't start if already running
    if (this.state === 'running') {
      console.log('[Browserlet] Execution blocked - already running');
      return {
        status: 'failed',
        error: 'Execution already in progress',
      };
    }

    // Store YAML content for potential navigation persistence
    this.yamlContent = yamlContent;

    // Store script context for screenshots
    this.scriptId = options?.scriptId ?? '';
    this.executionId = options?.executionId ?? '';

    // Parse the script
    console.log('[Browserlet] Parsing YAML content...');
    try {
      this.script = parseSteps(yamlContent);
      console.log('[Browserlet] Script parsed successfully, steps:', this.script.steps.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parse error';
      console.error('[Browserlet] Parse error:', message);
      this.emit({ type: 'error', error: message });
      return {
        status: 'failed',
        error: message,
      };
    }

    // Pre-flight credential validation: extract all credential references from all steps
    const allCredentialNames = new Set<string>();
    for (const step of this.script.steps) {
      if (step.value) {
        const refs = extractCredentialRefs(step.value);
        refs.forEach(ref => allCredentialNames.add(ref.name));
      }
    }

    // If credentials are needed, validate vault and credentials exist
    if (allCredentialNames.size > 0) {
      // Check vault is unlocked (via messaging to background)
      const vaultResponse = await chrome.runtime.sendMessage({ type: 'GET_VAULT_STATE' });
      const vaultState = vaultResponse?.data as VaultState | undefined;
      if (!vaultState || vaultState.isLocked) {
        this.emit({ type: 'auth_required' });
        return {
          status: 'failed',
          error: 'Password vault is locked. Unlock the vault to run scripts with credential references.',
        };
      }

      // Fetch all passwords and validate references (via messaging to background)
      const passwordsResponse = await chrome.runtime.sendMessage({ type: 'GET_PASSWORDS' });
      const passwords = (passwordsResponse?.data as StoredPassword[]) || [];
      // Include both id and alias for credential lookup
      const passwordIds = new Set(passwords.flatMap(p => [p.id, p.alias].filter(Boolean) as string[]));

      const missing: string[] = [];
      for (const credName of allCredentialNames) {
        if (!passwordIds.has(credName)) {
          missing.push(credName);
        }
      }

      if (missing.length > 0) {
        return {
          status: 'failed',
          error: `Missing credentials: ${missing.join(', ')}. Add these in the Credential Manager before running this script.`,
        };
      }
    }

    // Set up abort controller for stop functionality
    this.abortController = new AbortController();

    // Configure session detector if script has session_check
    if (this.script.session_check) {
      this.sessionDetector.setConfig(this.script.session_check);
      this.sessionDetector.onAuthenticationRequired(() => {
        this.emit({ type: 'auth_required' });
      });
    }

    // Reset or resume state
    const startStep = options?.startStep ?? 0;
    this.currentStep = startStep;
    this.results.clear();

    // Reset healing attempts for new execution
    resetHealingAttempts();

    // Restore previous results if resuming
    if (options?.previousResults) {
      for (const [key, value] of Object.entries(options.previousResults)) {
        this.results.set(key, value);
      }
    }

    this.setState('running');

    const totalSteps = this.script.steps.length;

    // If resuming, emit initial progress
    if (startStep > 0) {
      console.log('[Browserlet] Resuming execution from step', startStep + 1);
      this.emit({
        type: 'progress',
        step: startStep,
        totalSteps,
      });
    }

    // Execute steps sequentially (starting from startStep for resume)
    console.log('[Browserlet] Starting execution loop, total steps:', totalSteps);
    try {
      for (let i = startStep; i < totalSteps; i++) {
        console.log('[Browserlet] Processing step', i + 1, 'of', totalSteps);

        // Check if aborted
        if (this.abortController.signal.aborted) {
          this.setState('stopped');
          return {
            status: 'stopped',
            step: i,
            results: this.getResults(),
          };
        }

        this.currentStep = i;
        const step = this.script.steps[i];
        console.log('[Browserlet] Step', i + 1, 'action:', step?.action);

        // Safety check (should never happen due to bounds)
        if (!step) {
          throw new Error(`Step ${i + 1} not found in script`);
        }

        // Check session before each step (if configured)
        await this.checkSession();

        // Check if aborted after session check
        if (this.abortController.signal.aborted) {
          this.setState('stopped');
          return {
            status: 'stopped',
            step: i,
            results: this.getResults(),
          };
        }

        // Save state BEFORE executing any step that might cause navigation
        // This handles click actions on login buttons, form submits, etc.
        if (step.action === 'click' || step.action === 'submit') {
          await this.saveStateForNavigation(i + 1);
        }

        // Execute the step
        await this.executeStep(step, i);

        // Emit progress after successful step
        this.emit({
          type: 'progress',
          step: i + 1, // 1-based for display
          totalSteps,
        });

        // Wait between steps (humanized delay) - skip after last step
        if (i < totalSteps - 1) {
          await humanizedWait(this.config);
        }
      }

      // All steps completed successfully
      this.setState('idle');
      const finalResults = this.getResults();
      console.log('[Browserlet] Execution completed, final results:', finalResults);
      return {
        status: 'completed',
        step: totalSteps,
        results: finalResults,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const errorWithStep = `Step ${this.currentStep + 1}: ${message}`;

      // Capture failure screenshot (SHOT-02)
      if (this.scriptId) {
        await captureFailureScreenshot({
          scriptId: this.scriptId,
          executionId: this.executionId,
          stepIndex: this.currentStep + 1,
          failureReason: message,
        });
      }

      this.emit({ type: 'error', error: errorWithStep });
      this.setState('idle');

      return {
        status: 'failed',
        step: this.currentStep,
        error: errorWithStep,
        results: this.getResults(),
      };
    }
  }

  /**
   * Stop execution immediately
   * Aborts current operation and resets state
   */
  stop(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.sessionDetector.stopWaiting();
    this.setState('stopped');
  }

  /**
   * Execute a single step
   * @param step - The BSL step to execute
   * @param index - Step index for error messages
   */
  private async executeStep(step: BSLStep, index: number): Promise<void> {
    // Clone step to avoid mutating original
    const processedStep = { ...step };

    // Substitute extracted variables in value field (works for type action, navigate URL, etc.)
    if (processedStep.value && hasExtractedVariables(processedStep.value)) {
      try {
        processedStep.value = substituteVariables(
          processedStep.value,
          Object.fromEntries(this.results)
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Variable substitution failed';
        throw new Error(message);
      }
    }

    let element: Element | undefined;
    let currentHints = processedStep.target?.hints || [];

    // Resolve element for actions that need a target
    if (currentHints.length > 0) {
      console.log('[Browserlet] Resolving element with hints:', JSON.stringify(currentHints));
      const timeout = parseTimeout(processedStep.timeout);
      console.log('[Browserlet] Timeout:', timeout, 'ms');

      // Element resolution loop with healing support
      let resolved = false;
      let lastError: Error | null = null;

      while (!resolved) {
        try {
          const result = await waitForElement(currentHints, timeout);
          console.log('[Browserlet] Element resolved, confidence:', result.confidence);

          if (result.element) {
            element = result.element;
            resolved = true;
            // Reset healing attempts on success
            resetHealingAttempts(index);
          } else {
            // Low confidence - check if we should trigger healing
            if (detectHealingNeeded(result, HEALING_CONFIDENCE_THRESHOLD)) {
              // Check if max attempts reached
              if (maxHealingAttemptsReached(index)) {
                throw new Error(
                  `Element not found after ${MAX_HEALING_ATTEMPTS} healing attempts. ` +
                  `Last confidence: ${Math.round(result.confidence * 100)}%. ` +
                  `Hints: [${result.matchedHints.join(', ')}] matched. ` +
                  `Failed: [${result.failedHints.join(', ')}].`
                );
              }

              // Increment attempts
              const attempts = incrementHealingAttempts(index);
              console.log(`[Browserlet] Healing attempt ${attempts}/${MAX_HEALING_ATTEMPTS} for step ${index + 1}`);

              // Build healing context
              const healingContext = buildHealingContext(index, currentHints, result);

              // Request healing from user/LLM
              const newHints = await this.requestHealing(healingContext);

              if (newHints && newHints.length > 0) {
                // User approved healing - retry with new hints
                console.log('[Browserlet] Retrying with healed hints:', newHints);
                currentHints = newHints;
                this.setState('running');
                // Continue loop to retry
              } else {
                // Healing rejected - fail the step
                throw new Error(
                  `Element not found. Healing rejected. ` +
                  `Hints: [${result.matchedHints.join(', ')}] matched with ${Math.round(result.confidence * 100)}% confidence.`
                );
              }
            } else {
              // Try fallback selector if available
              if (processedStep.target?.fallback_selector) {
                const fallbackElement = document.querySelector(processedStep.target.fallback_selector);
                if (fallbackElement) {
                  element = fallbackElement;
                  resolved = true;
                } else {
                  throw new Error(
                    `Element not found. Hints: [${result.matchedHints.join(', ')}] matched with ${Math.round(result.confidence * 100)}% confidence. ` +
                    `Fallback selector "${processedStep.target.fallback_selector}" also failed.`
                  );
                }
              } else {
                throw new Error(
                  `Element not found. Hints: [${result.matchedHints.join(', ')}] matched with ${Math.round(result.confidence * 100)}% confidence (< 70% threshold). ` +
                  `Failed hints: [${result.failedHints.join(', ')}].`
                );
              }
            }
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');

          // Check if this is a timeout - might need healing
          if (lastError.message.includes('timeout') || lastError.message.includes('waitForElement')) {
            // Check if max attempts reached
            if (maxHealingAttemptsReached(index)) {
              // Try fallback selector as last resort
              if (processedStep.target?.fallback_selector) {
                const fallbackElement = document.querySelector(processedStep.target.fallback_selector);
                if (fallbackElement) {
                  element = fallbackElement;
                  resolved = true;
                  continue;
                }
              }
              throw new Error(
                `Element not found after ${MAX_HEALING_ATTEMPTS} healing attempts. ` +
                `${lastError.message}`
              );
            }

            // Increment attempts
            const attempts = incrementHealingAttempts(index);
            console.log(`[Browserlet] Healing attempt ${attempts}/${MAX_HEALING_ATTEMPTS} for step ${index + 1} (timeout)`);

            // Build healing context (with immediate resolve for error context)
            const immediateResult = resolveElement(currentHints);
            const healingContext = buildHealingContext(index, currentHints, immediateResult);

            // Request healing
            const newHints = await this.requestHealing(healingContext);

            if (newHints && newHints.length > 0) {
              // Retry with new hints
              console.log('[Browserlet] Retrying with healed hints after timeout:', newHints);
              currentHints = newHints;
              this.setState('running');
              // Continue loop
            } else {
              // Healing rejected - try fallback or fail
              if (processedStep.target?.fallback_selector) {
                const fallbackElement = document.querySelector(processedStep.target.fallback_selector);
                if (fallbackElement) {
                  element = fallbackElement;
                  resolved = true;
                  continue;
                }
              }
              throw new Error(
                `Element not found. Healing rejected. ${lastError.message}`
              );
            }
          } else {
            // Non-timeout error - try fallback or rethrow
            if (processedStep.target?.fallback_selector) {
              const fallbackElement = document.querySelector(processedStep.target.fallback_selector);
              if (fallbackElement) {
                element = fallbackElement;
                resolved = true;
                continue;
              }
            }
            throw lastError;
          }
        }
      }
    }

    // Handle screenshot action (SHOT-01)
    if (processedStep.action === 'screenshot') {
      await captureScreenshot({
        scriptId: this.scriptId,
        executionId: this.executionId,
        stepIndex: index + 1, // 1-based for display
      });
      return; // No further action needed
    }

    // For navigate action, save state BEFORE navigation (page will reload)
    if (processedStep.action === 'navigate') {
      // Save state so we can resume on the new page
      await this.saveStateForNavigation(index + 1);
      // Execute navigate - this will destroy the current script context
      await this.actionExecutor.execute(processedStep, element);
      // This line will likely never be reached as the page navigates
      return;
    }

    // Execute the action
    console.log('[Browserlet] Executing action:', processedStep.action);
    const result = await this.actionExecutor.execute(processedStep, element);
    console.log('[Browserlet] Action result:', result);

    // Store extract/table_extract results if action has output variable
    if ((processedStep.action === 'extract' || processedStep.action === 'table_extract') && processedStep.output?.variable) {
      // Validate variable name starts with "extracted." prefix
      if (!processedStep.output.variable.startsWith('extracted.')) {
        throw new Error(
          `Variable name must start with "extracted." prefix. Got: "${processedStep.output.variable}"`
        );
      }
      console.log('[Browserlet] Storing extraction result:', { variable: processedStep.output.variable, result });
      this.results.set(processedStep.output.variable, result);
      console.log('[Browserlet] Current results map:', Object.fromEntries(this.results));
    }
  }

  /**
   * Check session and wait for authentication if needed
   */
  private async checkSession(): Promise<void> {
    // Skip if no session_check configured
    if (!this.script?.session_check) {
      return;
    }

    // Check if authenticated
    if (this.sessionDetector.isAuthenticated()) {
      return; // All good, continue execution
    }

    // Not authenticated - pause execution and wait
    this.setState('waiting_auth');

    // Wait for user to authenticate
    await this.sessionDetector.waitForAuthentication();

    // Resume execution
    this.setState('running');
  }

  /**
   * Request healing for a failed element resolution
   * Sends HEALING_REQUESTED message to background and waits for response
   * @param context - Healing context with failure details
   * @returns New hints if approved, null if rejected
   */
  private async requestHealing(context: HealingContext): Promise<SemanticHint[] | null> {
    console.log('[Browserlet] Requesting healing for step', context.stepIndex + 1);

    // Store context for potential retry
    this.pendingHealingContext = context;

    // Set state to waiting for healing
    this.setState('waiting_healing');

    // Emit healing_requested event for UI
    this.emit({
      type: 'healing_requested',
      step: context.stepIndex + 1,
      healingContext: context,
    });

    // Send message to background service worker
    try {
      await chrome.runtime.sendMessage({
        type: 'HEALING_REQUESTED',
        payload: context,
      });
    } catch (error) {
      console.error('[Browserlet] Failed to send healing request:', error);
    }

    // Wait for healing response (resolved by applyHealing or rejectHealing)
    return new Promise<SemanticHint[] | null>((resolve) => {
      this.healingResolver = resolve;
    });
  }

  /**
   * Apply approved healing with new hints
   * Called by external code when user approves a repair suggestion
   * @param hints - New semantic hints to try
   */
  applyHealing(hints: SemanticHint[]): void {
    if (!this.healingResolver) {
      console.warn('[Browserlet] No pending healing request to apply');
      return;
    }

    console.log('[Browserlet] Applying healing with new hints:', hints);
    this.pendingHealingContext = null;
    const resolver = this.healingResolver;
    this.healingResolver = null;
    resolver(hints);
  }

  /**
   * Reject healing and fail the step
   * Called by external code when user rejects repair
   */
  rejectHealing(): void {
    if (!this.healingResolver) {
      console.warn('[Browserlet] No pending healing request to reject');
      return;
    }

    console.log('[Browserlet] Healing rejected by user');
    this.pendingHealingContext = null;
    const resolver = this.healingResolver;
    this.healingResolver = null;
    resolver(null);
  }

  /**
   * Get current pending healing context
   */
  getPendingHealingContext(): HealingContext | null {
    return this.pendingHealingContext;
  }

}

// Re-export all types and modules for convenient imports
export * from './types';
export { ActionExecutor, executeExtract, executeTableExtract } from './actionExecutor';
export { extractValue, extractTable } from './dataExtraction';
export { SessionDetector, checkSessionActive, DEFAULT_LOGIN_PATTERNS } from './sessionDetector';
export { humanizedWait, randomDelay, DEFAULT_CONFIG } from './humanizer';
export type { HumanizerConfig } from './humanizer';
export { waitForElement, resolveElement, isElementInteractable, HINT_WEIGHTS } from './semanticResolver';
export { substituteVariables, hasExtractedVariables, extractVariableRefs } from './variableSubstitution';
export {
  detectHealingNeeded,
  extractDOMContext,
  getPageContext,
  buildHealingContext,
  getHealingAttempts,
  incrementHealingAttempts,
  resetHealingAttempts,
  maxHealingAttemptsReached,
  HEALING_CONFIDENCE_THRESHOLD,
  AUTO_SUGGEST_CONFIDENCE_THRESHOLD,
  MAX_HEALING_ATTEMPTS,
} from './healingDetector';
export { captureScreenshot, captureFailureScreenshot } from './screenshotCapture';
