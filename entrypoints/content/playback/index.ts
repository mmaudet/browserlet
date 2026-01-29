/**
 * PlaybackManager - Central orchestrator for BSL script execution
 * Coordinates all playback modules: parser, executor, session detector, humanizer
 * Covers requirements: EXEC-02, EXEC-06, EXEC-07
 */

// Parser utilities
import { parseSteps, parseTimeout } from '../../../utils/yaml/stepParser';

// Types
import type {
  PlaybackState,
  ExecutionResult,
  ParsedScript,
  BSLStep,
} from './types';

// Modules
import { ActionExecutor } from './actionExecutor';
import { SessionDetector } from './sessionDetector';
import { humanizedWait, DEFAULT_CONFIG } from './humanizer';
import type { HumanizerConfig } from './humanizer';
import { waitForElement } from './semanticResolver';

/**
 * Event handler type for playback events
 */
export type PlaybackEventHandler = (event: {
  type: 'state_changed' | 'progress' | 'auth_required' | 'error';
  state?: PlaybackState;
  step?: number;
  totalSteps?: number;
  error?: string;
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

  private actionExecutor: ActionExecutor;
  private sessionDetector: SessionDetector;
  private eventHandler: PlaybackEventHandler | null = null;
  private config: HumanizerConfig;

  constructor(config: HumanizerConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.actionExecutor = new ActionExecutor(config);
    this.sessionDetector = new SessionDetector();
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
   * @returns Execution result with status and any errors
   */
  async execute(yamlContent: string): Promise<ExecutionResult> {
    // Don't start if already running
    if (this.state === 'running') {
      return {
        status: 'failed',
        error: 'Execution already in progress',
      };
    }

    // Parse the script
    try {
      this.script = parseSteps(yamlContent);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parse error';
      this.emit({ type: 'error', error: message });
      return {
        status: 'failed',
        error: message,
      };
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

    // Reset state
    this.currentStep = 0;
    this.results.clear();
    this.setState('running');

    const totalSteps = this.script.steps.length;

    // Execute steps sequentially
    try {
      for (let i = 0; i < totalSteps; i++) {
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
      return {
        status: 'completed',
        step: totalSteps,
        results: this.getResults(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const errorWithStep = `Step ${this.currentStep + 1}: ${message}`;

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
    // TODO: Implement in Task 3
    throw new Error('Not implemented');
  }

  /**
   * Check session and wait for authentication if needed
   */
  private async checkSession(): Promise<void> {
    // TODO: Implement in Task 3
  }
}

// Re-export all types and modules for convenient imports
export * from './types';
export { ActionExecutor } from './actionExecutor';
export { SessionDetector, checkSessionActive, DEFAULT_LOGIN_PATTERNS } from './sessionDetector';
export { humanizedWait, randomDelay, DEFAULT_CONFIG } from './humanizer';
export type { HumanizerConfig } from './humanizer';
export { waitForElement, resolveElement, isElementInteractable, HINT_WEIGHTS } from './semanticResolver';
