import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeForLog,
  redactCredentialValues,
  createSanitizedLogger,
} from '../../../packages/cli/src/credentials/sanitizer.js';

describe('Credential Sanitizer', () => {
  describe('sanitizeForLog', () => {
    it('replaces {{credential:name}} patterns with {{credential:***}}', () => {
      const input = 'fill {{credential:github-token}} into field';
      expect(sanitizeForLog(input)).toBe(
        'fill {{credential:***}} into field'
      );
    });

    it('replaces multiple credential patterns', () => {
      const input = 'login {{credential:user}} pass {{credential:pwd}}';
      expect(sanitizeForLog(input)).toBe(
        'login {{credential:***}} pass {{credential:***}}'
      );
    });

    it('leaves text without credential patterns unchanged', () => {
      const input = 'no credentials here';
      expect(sanitizeForLog(input)).toBe('no credentials here');
    });

    it('also redacts known values when provided', () => {
      const input = 'The password is s3cret123 ok?';
      expect(sanitizeForLog(input, ['s3cret123'])).toBe(
        'The password is [REDACTED] ok?'
      );
    });

    it('redacts both patterns and values simultaneously', () => {
      const input = 'Using {{credential:pwd}} value is s3cret';
      expect(sanitizeForLog(input, ['s3cret'])).toBe(
        'Using {{credential:***}} value is [REDACTED]'
      );
    });
  });

  describe('redactCredentialValues', () => {
    it('replaces known values with [REDACTED]', () => {
      const result = redactCredentialValues('password is abc123', ['abc123']);
      expect(result).toBe('password is [REDACTED]');
    });

    it('replaces multiple occurrences of the same value', () => {
      const result = redactCredentialValues(
        'first: abc123, second: abc123',
        ['abc123']
      );
      expect(result).toBe('first: [REDACTED], second: [REDACTED]');
    });

    it('handles overlapping values - longer value replaced first', () => {
      const result = redactCredentialValues(
        'value is password123',
        ['password', 'password123']
      );
      // password123 (longer) should be matched first, producing [REDACTED]
      // not [REDACTED]123
      expect(result).toBe('value is [REDACTED]');
    });

    it('replaces multiple different values', () => {
      const result = redactCredentialValues(
        'user admin pass s3cret',
        ['admin', 's3cret']
      );
      expect(result).toBe('user [REDACTED] pass [REDACTED]');
    });

    it('returns text unchanged when no known values', () => {
      expect(redactCredentialValues('nothing to redact', [])).toBe(
        'nothing to redact'
      );
    });

    it('handles empty strings in known values gracefully', () => {
      const result = redactCredentialValues('hello world', ['', 'world']);
      expect(result).toBe('hello [REDACTED]');
    });

    it('handles special regex characters in credential values', () => {
      const result = redactCredentialValues(
        'pass is p@ss.w0rd+!',
        ['p@ss.w0rd+!']
      );
      expect(result).toBe('pass is [REDACTED]');
    });
  });

  describe('createSanitizedLogger', () => {
    let logSpy: ReturnType<typeof vi.spyOn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;
    let debugSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('wraps console.log with redaction', () => {
      const logger = createSanitizedLogger(['secret123']);
      logger.log('Password is secret123');

      expect(logSpy).toHaveBeenCalledWith('Password is [REDACTED]');
    });

    it('wraps console.warn with redaction', () => {
      const logger = createSanitizedLogger(['apikey']);
      logger.warn('Warning: apikey exposed');

      expect(warnSpy).toHaveBeenCalledWith('Warning: [REDACTED] exposed');
    });

    it('wraps console.error with redaction', () => {
      const logger = createSanitizedLogger(['dbpass']);
      logger.error('Error: dbpass failed');

      expect(errorSpy).toHaveBeenCalledWith('Error: [REDACTED] failed');
    });

    it('wraps console.debug with redaction', () => {
      const logger = createSanitizedLogger(['token']);
      logger.debug('Debug: token value');

      expect(debugSpy).toHaveBeenCalledWith('Debug: [REDACTED] value');
    });

    it('passes non-string arguments unchanged', () => {
      const logger = createSanitizedLogger(['secret']);
      const obj = { key: 'secret' };
      logger.log('message', 42, obj, true);

      expect(logSpy).toHaveBeenCalledWith('message', 42, obj, true);
    });

    it('redacts multiple string arguments', () => {
      const logger = createSanitizedLogger(['pwd']);
      logger.log('first: pwd', 'second: pwd');

      expect(logSpy).toHaveBeenCalledWith(
        'first: [REDACTED]',
        'second: [REDACTED]'
      );
    });

    it('credential plaintext never appears in output', () => {
      const secretValue = 'my-super-secret-p@$$w0rd!';
      const logger = createSanitizedLogger([secretValue]);

      logger.log(`Connecting with password ${secretValue}`);
      logger.warn(`Failed auth: ${secretValue}`);
      logger.error(`Credential dump: ${secretValue}`);

      // Verify that the actual secret never appears in any call
      for (const spy of [logSpy, warnSpy, errorSpy]) {
        for (const call of spy.mock.calls) {
          for (const arg of call) {
            if (typeof arg === 'string') {
              expect(arg).not.toContain(secretValue);
              expect(arg).toContain('[REDACTED]');
            }
          }
        }
      }
    });
  });
});
