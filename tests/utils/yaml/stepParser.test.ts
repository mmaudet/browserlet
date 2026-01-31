import { describe, it, expect } from 'vitest';
import { parseSteps, parseTimeout } from '../../../utils/yaml/stepParser';

describe('parseTimeout', () => {
  it('should return 10000 for "10s"', () => {
    expect(parseTimeout('10s')).toBe(10000);
  });

  it('should return 5000 for "5000ms"', () => {
    expect(parseTimeout('5000ms')).toBe(5000);
  });

  it('should return 30000 for "30" (assumes seconds)', () => {
    expect(parseTimeout('30')).toBe(30000);
  });

  it('should return 10000 (default) for undefined', () => {
    expect(parseTimeout(undefined)).toBe(10000);
  });

  it('should return 10000 (default) for invalid format', () => {
    expect(parseTimeout('abc')).toBe(10000);
    expect(parseTimeout('10x')).toBe(10000);
    expect(parseTimeout('')).toBe(10000);
  });

  it('should handle edge cases', () => {
    expect(parseTimeout('0s')).toBe(0);
    expect(parseTimeout('1ms')).toBe(1);
    expect(parseTimeout('60')).toBe(60000);
  });
});

describe('parseSteps', () => {
  describe('valid scripts', () => {
    it('should parse a valid script with multiple steps', () => {
      const yaml = `
name: Test Script
steps:
  - action: click
    target:
      hints:
        - type: role
          value: button
  - action: type
    target:
      hints:
        - type: name
          value: email
    value: test@example.com
`;

      const result = parseSteps(yaml);

      expect(result.name).toBe('Test Script');
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0]?.action).toBe('click');
      expect(result.steps[1]?.action).toBe('type');
      expect(result.steps[1]?.value).toBe('test@example.com');
    });

    it('should extract metadata fields', () => {
      const yaml = `
name: My Script
version: 1.2.0
description: A test script
target_app: example.com
author: tester
tags:
  - login
  - automation
steps:
  - action: navigate
    value: https://example.com
`;

      const result = parseSteps(yaml);

      expect(result.name).toBe('My Script');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.version).toBe('1.2.0');
      expect(result.metadata?.description).toBe('A test script');
      expect(result.metadata?.target_app).toBe('example.com');
      expect(result.metadata?.author).toBe('tester');
      expect(result.metadata?.tags).toEqual(['login', 'automation']);
    });

    it('should extract session_check config when present', () => {
      const yaml = `
name: Login Script
session_check:
  indicator:
    hints:
      - type: text_contains
        value: Logout
  url_patterns:
    - /dashboard
steps:
  - action: navigate
    value: https://example.com
`;

      const result = parseSteps(yaml);

      expect(result.session_check).toBeDefined();
      expect(result.session_check?.indicator?.hints).toHaveLength(1);
      expect(result.session_check?.url_patterns).toEqual(['/dashboard']);
    });

    it('should parse all valid action types', () => {
      const yaml = `
name: Action Test
steps:
  - action: click
    target:
      hints: []
  - action: type
    target:
      hints: []
    value: text
  - action: select
    target:
      hints: []
    value: option
  - action: extract
    target:
      hints: []
  - action: wait_for
    target:
      hints: []
  - action: navigate
    value: https://example.com
  - action: scroll
    target:
      hints: []
  - action: hover
    target:
      hints: []
`;

      const result = parseSteps(yaml);

      expect(result.steps).toHaveLength(8);
      expect(result.steps.map((s) => s.action)).toEqual([
        'click',
        'type',
        'select',
        'extract',
        'wait_for',
        'navigate',
        'scroll',
        'hover',
      ]);
    });

    it('should parse step with id and timeout', () => {
      const yaml = `
name: ID Test
steps:
  - id: login_button
    action: click
    target:
      hints: []
    timeout: 30s
`;

      const result = parseSteps(yaml);

      expect(result.steps[0]?.id).toBe('login_button');
      expect(result.steps[0]?.timeout).toBe('30s');
    });

    it('should parse navigate action with url field (recording format)', () => {
      const yaml = `
name: Navigate Test
steps:
  - action: navigate
    url: https://example.com/page
`;

      const result = parseSteps(yaml);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]?.action).toBe('navigate');
      expect(result.steps[0]?.value).toBe('https://example.com/page');
    });

    it('should parse step with output variable', () => {
      const yaml = `
name: Extract Test
steps:
  - action: extract
    target:
      hints:
        - type: role
          value: heading
    output:
      variable: title
      transform: trim
`;

      const result = parseSteps(yaml);

      expect(result.steps[0]?.output).toBeDefined();
      expect(result.steps[0]?.output?.variable).toBe('title');
      expect(result.steps[0]?.output?.transform).toBe('trim');
    });

    it('should parse target with intent and fallback_selector', () => {
      const yaml = `
name: Target Test
steps:
  - action: click
    target:
      intent: Click the submit button
      hints:
        - type: role
          value: button
      fallback_selector: "#submit-btn"
`;

      const result = parseSteps(yaml);

      expect(result.steps[0]?.target?.intent).toBe('Click the submit button');
      expect(result.steps[0]?.target?.fallback_selector).toBe('#submit-btn');
    });
  });

  describe('error handling', () => {
    it('should throw error for missing name', () => {
      const yaml = `
steps:
  - action: click
    target:
      hints: []
`;

      expect(() => parseSteps(yaml)).toThrow(
        'Invalid BSL script: missing or invalid "name" field'
      );
    });

    it('should throw error for missing steps', () => {
      const yaml = `
name: Test Script
`;

      expect(() => parseSteps(yaml)).toThrow(
        'Invalid BSL script: missing or invalid "steps" array'
      );
    });

    it('should throw error for invalid action type', () => {
      const yaml = `
name: Test Script
steps:
  - action: invalid_action
    target:
      hints: []
`;

      expect(() => parseSteps(yaml)).toThrow(
        'Step 1: invalid action "invalid_action"'
      );
    });

    it('should throw error for navigate step without url or value', () => {
      const yaml = `
name: Test Script
steps:
  - action: navigate
`;

      expect(() => parseSteps(yaml)).toThrow(
        'Step 1: navigate action requires a "url" or "value" (URL)'
      );
    });

    it('should throw error for click step without target', () => {
      const yaml = `
name: Test Script
steps:
  - action: click
`;

      expect(() => parseSteps(yaml)).toThrow(
        'Step 1: action "click" requires a "target" object'
      );
    });

    it('should throw error for target without hints array', () => {
      const yaml = `
name: Test Script
steps:
  - action: click
    target:
      intent: Click something
`;

      expect(() => parseSteps(yaml)).toThrow(
        'Step 1: target must have a "hints" array'
      );
    });

    it('should include step index in error messages', () => {
      const yaml = `
name: Test Script
steps:
  - action: click
    target:
      hints: []
  - action: type
    target:
      hints: []
  - action: invalid_action
    target:
      hints: []
`;

      expect(() => parseSteps(yaml)).toThrow('Step 3:');
    });

    it('should throw error for invalid YAML syntax', () => {
      const yaml = `
name: Test Script
steps:
  - action: click
    target:
      hints:
        - type: role
          value: [invalid
`;

      expect(() => parseSteps(yaml)).toThrow('YAML parsing failed');
    });

    it('should throw error for non-object script', () => {
      const yaml = `just a string`;

      expect(() => parseSteps(yaml)).toThrow(
        'Invalid BSL script: expected an object'
      );
    });
  });
});
