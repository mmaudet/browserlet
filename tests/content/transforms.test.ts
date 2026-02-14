/**
 * Tests for transform functions used in data extraction
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyTransform } from '@/entrypoints/content/playback/transforms';
import type { TransformType } from '@browserlet/core/types';

describe('applyTransform', () => {
  describe('text transforms', () => {
    it('trim removes leading and trailing whitespace', () => {
      expect(applyTransform(' hello ', 'trim')).toBe('hello');
    });

    it('trim handles tabs and newlines', () => {
      expect(applyTransform('\t\nhello world\n\t', 'trim')).toBe('hello world');
    });

    it('lowercase converts to lowercase', () => {
      expect(applyTransform('HELLO', 'lowercase')).toBe('hello');
    });

    it('lowercase handles mixed case', () => {
      expect(applyTransform('HeLLo WoRLD', 'lowercase')).toBe('hello world');
    });

    it('uppercase converts to uppercase', () => {
      expect(applyTransform('hello', 'uppercase')).toBe('HELLO');
    });

    it('uppercase handles mixed case', () => {
      expect(applyTransform('HeLLo WoRLD', 'uppercase')).toBe('HELLO WORLD');
    });
  });

  describe('parse_number', () => {
    describe('with US locale', () => {
      beforeEach(() => {
        vi.stubGlobal('navigator', { language: 'en-US' });
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('parses US format (1,234.56)', () => {
        expect(applyTransform('1,234.56', 'parse_number')).toBe(1234.56);
      });

      it('parses simple integer', () => {
        expect(applyTransform('42', 'parse_number')).toBe(42);
      });

      it('parses negative number', () => {
        expect(applyTransform('-123.45', 'parse_number')).toBe(-123.45);
      });

      it('parses number with leading/trailing spaces', () => {
        expect(applyTransform('  1234  ', 'parse_number')).toBe(1234);
      });
    });

    describe('with EU locale', () => {
      beforeEach(() => {
        vi.stubGlobal('navigator', { language: 'fr-FR' });
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('parses EU format (1.234,56)', () => {
        expect(applyTransform('1.234,56', 'parse_number')).toBe(1234.56);
      });

      it('parses EU format with multiple thousand separators', () => {
        expect(applyTransform('1.234.567,89', 'parse_number')).toBe(1234567.89);
      });
    });

    it('throws on invalid number', () => {
      vi.stubGlobal('navigator', { language: 'en-US' });
      expect(() => applyTransform('abc', 'parse_number')).toThrow(
        'Cannot parse "abc" as number'
      );
      vi.unstubAllGlobals();
    });

    it('throws on empty string', () => {
      vi.stubGlobal('navigator', { language: 'en-US' });
      expect(() => applyTransform('', 'parse_number')).toThrow(
        'Cannot parse "" as number'
      );
      vi.unstubAllGlobals();
    });
  });

  describe('parse_currency', () => {
    describe('with US locale', () => {
      beforeEach(() => {
        vi.stubGlobal('navigator', { language: 'en-US' });
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('parses USD format ($1,234.56)', () => {
        expect(applyTransform('$1,234.56', 'parse_currency')).toBe(1234.56);
      });

      it('parses negative currency (-$100.00)', () => {
        expect(applyTransform('-$100.00', 'parse_currency')).toBe(-100);
      });

      it('parses currency with text (USD 1,234.56)', () => {
        expect(applyTransform('USD 1,234.56', 'parse_currency')).toBe(1234.56);
      });
    });

    describe('with EU locale', () => {
      beforeEach(() => {
        vi.stubGlobal('navigator', { language: 'de-DE' });
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('parses EUR format (1.234,56 EUR)', () => {
        expect(applyTransform('1.234,56 EUR', 'parse_currency')).toBe(1234.56);
      });

      it('parses EUR format with symbol (1.234,56 E)', () => {
        expect(applyTransform('1.234,56 E', 'parse_currency')).toBe(1234.56);
      });
    });

    it('throws on N/A value', () => {
      expect(() => applyTransform('N/A', 'parse_currency')).toThrow(
        'Cannot parse "N/A" as currency'
      );
    });

    it('throws on dash placeholder', () => {
      expect(() => applyTransform('--', 'parse_currency')).toThrow(
        'Cannot parse "--" as currency'
      );
    });

    it('throws on text without numbers', () => {
      expect(() => applyTransform('Not available', 'parse_currency')).toThrow(
        'Cannot parse "Not available" as currency'
      );
    });
  });

  describe('parse_date', () => {
    it('parses ISO date (2026-02-01)', () => {
      expect(applyTransform('2026-02-01', 'parse_date')).toBe(
        '2026-02-01T00:00:00.000Z'
      );
    });

    it('parses ISO datetime', () => {
      const result = applyTransform('2026-02-01T15:30:00Z', 'parse_date');
      expect(result).toBe('2026-02-01T15:30:00.000Z');
    });

    it('parses date with timezone offset', () => {
      const result = applyTransform('2026-02-01T15:30:00+01:00', 'parse_date');
      // Should be converted to UTC
      expect(result).toBe('2026-02-01T14:30:00.000Z');
    });

    it('throws on invalid date', () => {
      expect(() => applyTransform('invalid', 'parse_date')).toThrow(
        'Cannot parse "invalid" as date'
      );
    });

    it('throws on empty string', () => {
      expect(() => applyTransform('', 'parse_date')).toThrow(
        'Cannot parse "" as date'
      );
    });

    it('throws on not-a-date text', () => {
      expect(() => applyTransform('not-a-date', 'parse_date')).toThrow(
        'Cannot parse "not-a-date" as date'
      );
    });
  });

  describe('extract_number', () => {
    describe('basic extraction', () => {
      beforeEach(() => {
        vi.stubGlobal('navigator', { language: 'en-US' });
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('extracts number at end of string', () => {
        expect(applyTransform('Demandes en attente 4', 'extract_number')).toBe(4);
      });

      it('extracts number at start of string', () => {
        expect(applyTransform('4 tâches', 'extract_number')).toBe(4);
      });

      it('extracts number in middle of string', () => {
        expect(applyTransform('Il y a 42 messages', 'extract_number')).toBe(42);
      });

      it('extracts simple integer', () => {
        expect(applyTransform('42', 'extract_number')).toBe(42);
      });

      it('extracts negative number', () => {
        expect(applyTransform('Balance: -150', 'extract_number')).toBe(-150);
      });
    });

    describe('with US locale', () => {
      beforeEach(() => {
        vi.stubGlobal('navigator', { language: 'en-US' });
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('extracts US formatted number with decimal', () => {
        expect(applyTransform('Total: $1,234.56', 'extract_number')).toBe(1234.56);
      });

      it('extracts US formatted number with thousands', () => {
        expect(applyTransform('Population: 1,234,567', 'extract_number')).toBe(1234567);
      });
    });

    describe('with EU locale', () => {
      beforeEach(() => {
        vi.stubGlobal('navigator', { language: 'fr-FR' });
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('extracts EU formatted number with decimal', () => {
        expect(applyTransform('Prix: 29,99€', 'extract_number')).toBe(29.99);
      });

      it('extracts EU formatted number with thousands', () => {
        expect(applyTransform('Total: 1.234,56 EUR', 'extract_number')).toBe(1234.56);
      });
    });

    describe('error cases', () => {
      beforeEach(() => {
        vi.stubGlobal('navigator', { language: 'en-US' });
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      it('throws on string without numbers', () => {
        expect(() => applyTransform('No numbers here', 'extract_number')).toThrow(
          'Cannot extract number from "No numbers here"'
        );
      });

      it('throws on empty string', () => {
        expect(() => applyTransform('', 'extract_number')).toThrow(
          'Cannot extract number from empty string'
        );
      });

      it('throws on whitespace only', () => {
        expect(() => applyTransform('   ', 'extract_number')).toThrow(
          'Cannot extract number from empty string'
        );
      });
    });
  });

  describe('unknown transform', () => {
    it('throws on unknown transform type', () => {
      // @ts-expect-error - Testing runtime behavior with invalid type
      expect(() => applyTransform('value', 'unknown_transform')).toThrow(
        'Unknown transform: unknown_transform'
      );
    });
  });
});
