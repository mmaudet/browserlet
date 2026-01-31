/**
 * BSL step parser for playback execution
 */

import yaml from 'js-yaml';
import type { BSLStep, ParsedScript, ActionType, SessionCheckConfig } from '../../entrypoints/content/playback/types';

// Valid action types for BSL scripts
const VALID_ACTIONS: ActionType[] = [
  'click',
  'type',
  'select',
  'extract',
  'wait_for',
  'navigate',
  'scroll',
  'hover',
];

// Actions that require a target element
const TARGET_REQUIRED_ACTIONS: ActionType[] = [
  'click',
  'type',
  'select',
  'extract',
  'wait_for',
  'scroll',
  'hover',
];

/**
 * Parse timeout string to milliseconds
 * Supports formats: "10s", "5000ms", "30" (assumes seconds)
 * @param timeout - Timeout string or undefined
 * @returns Timeout in milliseconds (default: 10000)
 */
export function parseTimeout(timeout: string | undefined): number {
  const DEFAULT_TIMEOUT = 10000;

  if (timeout === undefined) {
    return DEFAULT_TIMEOUT;
  }

  const match = timeout.match(/^(\d+)(s|ms)?$/);
  if (!match || !match[1]) {
    return DEFAULT_TIMEOUT;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === 'ms') {
    return value;
  }

  // 's' or no unit: treat as seconds
  return value * 1000;
}

/**
 * Validate and convert a raw step object to BSLStep
 * @param step - Raw step object from YAML
 * @param index - Step index for error messages
 * @returns Validated BSLStep
 * @throws Error if step is invalid
 */
export function validateStep(step: unknown, index: number): BSLStep {
  if (typeof step !== 'object' || step === null) {
    throw new Error(`Step ${index + 1}: expected an object`);
  }

  const rawStep = step as Record<string, unknown>;

  // Validate action
  const action = rawStep.action;
  if (typeof action !== 'string') {
    throw new Error(`Step ${index + 1}: missing or invalid "action" field`);
  }

  if (!VALID_ACTIONS.includes(action as ActionType)) {
    throw new Error(
      `Step ${index + 1}: invalid action "${action}". Valid actions: ${VALID_ACTIONS.join(', ')}`
    );
  }

  const typedAction = action as ActionType;

  // Validate target for actions that need it
  if (TARGET_REQUIRED_ACTIONS.includes(typedAction)) {
    if (!rawStep.target || typeof rawStep.target !== 'object') {
      throw new Error(`Step ${index + 1}: action "${action}" requires a "target" object`);
    }

    const target = rawStep.target as Record<string, unknown>;
    if (!target.hints || !Array.isArray(target.hints)) {
      throw new Error(`Step ${index + 1}: target must have a "hints" array`);
    }
  }

  // Validate navigate action needs value or url (URL)
  if (typedAction === 'navigate') {
    // Accept both 'url' and 'value' for navigate actions (recording uses 'url')
    const navigateUrl = rawStep.url ?? rawStep.value;
    if (!navigateUrl || typeof navigateUrl !== 'string') {
      throw new Error(`Step ${index + 1}: navigate action requires a "url" or "value" (URL)`);
    }
    // Normalize: store URL in 'value' for the executor
    rawStep.value = navigateUrl;
  }

  // Construct validated BSLStep
  const bslStep: BSLStep = {
    action: typedAction,
  };

  if (rawStep.id !== undefined) {
    bslStep.id = String(rawStep.id);
  }

  if (rawStep.target && typeof rawStep.target === 'object') {
    const target = rawStep.target as Record<string, unknown>;
    bslStep.target = {
      hints: Array.isArray(target.hints) ? target.hints : [],
    };
    if (typeof target.intent === 'string') {
      bslStep.target.intent = target.intent;
    }
    if (typeof target.fallback_selector === 'string') {
      bslStep.target.fallback_selector = target.fallback_selector;
    }
  }

  if (rawStep.value !== undefined) {
    bslStep.value = String(rawStep.value);
  }

  if (rawStep.output && typeof rawStep.output === 'object') {
    const output = rawStep.output as Record<string, unknown>;
    if (typeof output.variable === 'string') {
      bslStep.output = {
        variable: output.variable,
      };
      if (typeof output.transform === 'string') {
        bslStep.output.transform = output.transform;
      }
    }
  }

  if (rawStep.timeout !== undefined) {
    bslStep.timeout = String(rawStep.timeout);
  }

  return bslStep;
}

/**
 * Parse session_check configuration from raw object
 * @param rawConfig - Raw session_check object from YAML
 * @returns Validated SessionCheckConfig
 */
function parseSessionCheck(rawConfig: unknown): SessionCheckConfig | undefined {
  if (!rawConfig || typeof rawConfig !== 'object') {
    return undefined;
  }

  const config = rawConfig as Record<string, unknown>;
  const result: SessionCheckConfig = {};

  if (config.indicator && typeof config.indicator === 'object') {
    const indicator = config.indicator as Record<string, unknown>;
    if (Array.isArray(indicator.hints)) {
      result.indicator = { hints: indicator.hints };
    }
  }

  if (config.absence_indicator && typeof config.absence_indicator === 'object') {
    const absenceIndicator = config.absence_indicator as Record<string, unknown>;
    if (Array.isArray(absenceIndicator.hints)) {
      result.absence_indicator = { hints: absenceIndicator.hints };
    }
  }

  if (Array.isArray(config.url_patterns)) {
    result.url_patterns = config.url_patterns.filter(
      (p): p is string => typeof p === 'string'
    );
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Parse BSL YAML content into a typed ParsedScript
 * @param yamlContent - Raw YAML string
 * @returns Parsed and validated script
 * @throws Error if YAML is invalid or script structure is wrong
 */
export function parseSteps(yamlContent: string): ParsedScript {
  let parsed: unknown;

  try {
    parsed = yaml.load(yamlContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`YAML parsing failed: ${message}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid BSL script: expected an object');
  }

  const rawScript = parsed as Record<string, unknown>;

  // Validate required fields
  if (!rawScript.name || typeof rawScript.name !== 'string') {
    throw new Error('Invalid BSL script: missing or invalid "name" field');
  }

  if (!rawScript.steps || !Array.isArray(rawScript.steps)) {
    throw new Error('Invalid BSL script: missing or invalid "steps" array');
  }

  // Validate and convert each step
  const steps: BSLStep[] = rawScript.steps.map((step, index) =>
    validateStep(step, index)
  );

  // Build ParsedScript
  const script: ParsedScript = {
    name: rawScript.name,
    steps,
  };

  // Extract optional metadata
  const metadataKeys = ['version', 'description', 'target_app', 'author', 'tags'];
  const metadata: Record<string, unknown> = {};

  for (const key of metadataKeys) {
    if (rawScript[key] !== undefined) {
      metadata[key] = rawScript[key];
    }
  }

  if (Object.keys(metadata).length > 0) {
    script.metadata = metadata;
  }

  // Extract session_check if present
  const sessionCheck = parseSessionCheck(rawScript.session_check);
  if (sessionCheck) {
    script.session_check = sessionCheck;
  }

  return script;
}
