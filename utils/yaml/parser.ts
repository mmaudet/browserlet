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
