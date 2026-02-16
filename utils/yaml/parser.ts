import yaml from 'js-yaml';
import type { Script } from '../types';

export type ParseResult = {
  success: true;
  data: Partial<Script>;
} | {
  success: false;
  error: string;
};

// Parse YAML string to script-like object
export function parseScript(yamlContent: string): ParseResult {
  try {
    const parsed = yaml.load(yamlContent);

    if (typeof parsed !== 'object' || parsed === null) {
      return { success: false, error: 'Invalid YAML: expected an object' };
    }

    const obj = parsed as Record<string, unknown>;

    // Validate required fields
    if (!obj.name || typeof obj.name !== 'string') {
      return { success: false, error: 'Invalid BSL script: missing or invalid "name" field' };
    }

    if (!obj.steps || !Array.isArray(obj.steps)) {
      return { success: false, error: 'Invalid BSL script: missing or invalid "steps" array' };
    }

    // Construct partial Script (ID will be assigned on save)
    const script: Partial<Script> = {
      name: obj.name,
      content: yamlContent, // Store original YAML
      version: typeof obj.version === 'string' ? obj.version : '1.0.0',
      description: typeof obj.description === 'string' ? obj.description : undefined,
      target_app: typeof obj.target_app === 'string' ? obj.target_app : undefined,
      author: typeof obj.author === 'string' ? obj.author : undefined,
      tags: Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === 'string') : undefined,
    };

    // Extract session_persistence if present (maps to Script.sessionPersistence)
    if (obj.session_persistence && typeof obj.session_persistence === 'object') {
      const sp = obj.session_persistence as Record<string, unknown>;
      if (typeof sp.enabled === 'boolean') {
        script.sessionPersistence = {
          enabled: sp.enabled,
          ...(typeof sp.ttl === 'number' ? { ttl: sp.ttl } : {}),
        };
      }
    }

    return { success: true, data: script };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parsing error';
    return { success: false, error: `YAML parsing failed: ${message}` };
  }
}

// Dump script to YAML string
export function dumpScript(script: Script): string {
  // If script has raw YAML content, return it directly
  if (script.content) {
    return script.content;
  }

  // Otherwise, construct YAML from metadata
  // This is a fallback; normally content is stored
  const obj: Record<string, unknown> = {
    name: script.name,
    version: script.version,
    steps: [] // Empty steps - content should normally exist
  };

  if (script.description) obj.description = script.description;
  if (script.target_app) obj.target_app = script.target_app;
  if (script.author) obj.author = script.author;
  if (script.tags && script.tags.length > 0) obj.tags = script.tags;

  return yaml.dump(obj, {
    indent: 2,
    lineWidth: -1, // No line wrapping
    noRefs: true   // No YAML anchors
  });
}

// Validate that parsed content has valid BSL structure
export function validateBSL(content: string): { valid: boolean; errors: string[] } {
  const result = parseScript(content);
  if (!result.success) {
    return { valid: false, errors: [result.error] };
  }

  // Additional validation can be added here for step structure
  // For now, basic validation is sufficient
  return { valid: true, errors: [] };
}

export type NormalizeResult = {
  success: true;
  content: string;
  changed: boolean;
} | {
  success: false;
  error: string;
};

/**
 * Normalize YAML content with consistent indentation (2 spaces).
 * Parses and re-dumps the YAML to fix indentation issues.
 *
 * @param content - Raw YAML string (possibly with inconsistent indentation)
 * @returns Normalized YAML string or error
 *
 * @example
 * const result = normalizeYAML(userInput);
 * if (result.success) {
 *   saveScript(result.content);
 * } else {
 *   showError(result.error);
 * }
 */
export function normalizeYAML(content: string): NormalizeResult {
  try {
    // Parse the YAML
    const parsed = yaml.load(content);

    if (typeof parsed !== 'object' || parsed === null) {
      return { success: false, error: 'Invalid YAML: expected an object' };
    }

    // Re-dump with consistent formatting
    const normalized = yaml.dump(parsed, {
      indent: 2,
      lineWidth: -1,    // No line wrapping
      noRefs: true,     // No YAML anchors/aliases
      quotingType: '"', // Use double quotes for strings
      forceQuotes: false, // Only quote when necessary
      sortKeys: false,  // Preserve key order
    });

    // Check if content changed (normalize both for comparison)
    const changed = content.trim() !== normalized.trim();

    return { success: true, content: normalized, changed };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parsing error';
    return { success: false, error: `YAML syntax error: ${message}` };
  }
}
