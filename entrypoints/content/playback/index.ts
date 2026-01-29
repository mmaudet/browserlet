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
   * Execute a BSL script from YAML content
   * @param yamlContent - YAML string containing BSL script
   * @returns Execution result with status and any errors
   */
  async execute(yamlContent: string): Promise<ExecutionResult> {
    // TODO: Implement in Task 2
    throw new Error('Not implemented');
  }

  /**
   * Stop execution immediately
   * Aborts current operation and resets state
   */
  stop(): void {
    // TODO: Implement in Task 2
  }
}

// Re-export all types and modules for convenient imports
export * from './types';
export { ActionExecutor } from './actionExecutor';
export { SessionDetector, checkSessionActive, DEFAULT_LOGIN_PATTERNS } from './sessionDetector';
export { humanizedWait, randomDelay, DEFAULT_CONFIG } from './humanizer';
export type { HumanizerConfig } from './humanizer';
export { waitForElement, resolveElement, isElementInteractable, HINT_WEIGHTS } from './semanticResolver';
