/**
 * Transform functions for data extraction
 *
 * Pure functions that take raw extracted string and return transformed value.
 * Fail-fast with clear error message if transform cannot be applied.
 */

import type { TransformType } from './types';

/**
 * Apply a transform to an extracted string value.
 *
 * @param value - The raw string value extracted from the page
 * @param transform - The transform type to apply
 * @returns The transformed value (string, number, or ISO date string)
 * @throws Error if the transform cannot be applied
 */
export function applyTransform(
  value: string,
  transform: TransformType
): string | number {
  switch (transform) {
    case 'trim':
      return value.trim();

    case 'lowercase':
      return value.toLowerCase();

    case 'uppercase':
      return value.toUpperCase();

    case 'parse_number':
      return parseLocaleNumber(value);

    case 'parse_currency':
      return parseCurrency(value);

    case 'parse_date':
      return parseDate(value);

    default: {
      // Exhaustive check - TypeScript will error if a transform type is missed
      const exhaustiveCheck: never = transform;
      throw new Error(`Unknown transform: ${exhaustiveCheck}`);
    }
  }
}

/**
 * Detect the decimal separator based on browser locale.
 * Uses Intl.NumberFormat to determine locale-specific formatting.
 */
function getLocaleDecimalSeparator(): string {
  const locale = navigator?.language || 'en-US';
  const formatter = new Intl.NumberFormat(locale);
  const parts = formatter.formatToParts(1234.5);
  const decimalPart = parts.find((p) => p.type === 'decimal');
  return decimalPart?.value || '.';
}

/**
 * Parse a locale-formatted number string.
 * Handles both US format (1,234.56) and EU format (1.234,56).
 *
 * @param value - Number string with locale-specific formatting
 * @returns The numeric value
 * @throws Error if value cannot be parsed as a number
 */
function parseLocaleNumber(value: string): number {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`Cannot parse "${value}" as number`);
  }

  // Detect locale decimal separator
  const decimalSep = getLocaleDecimalSeparator();

  // Extract only valid number characters (digits, separators, minus)
  const cleaned = trimmed.replace(/[^\d.,\-]/g, '');

  if (!cleaned) {
    throw new Error(`Cannot parse "${value}" as number`);
  }

  // Normalize to JavaScript number format (dot as decimal separator)
  let normalized: string;
  if (decimalSep === ',') {
    // European format: 1.234,56 -> remove dots (thousands), replace comma with dot
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // US format: 1,234.56 -> remove commas (thousands)
    normalized = cleaned.replace(/,/g, '');
  }

  const num = parseFloat(normalized);

  if (isNaN(num)) {
    throw new Error(`Cannot parse "${value}" as number`);
  }

  return num;
}

/**
 * Parse a currency string, stripping currency symbols and formatting.
 * Uses locale detection for decimal/thousand separator handling.
 *
 * @param value - Currency string (e.g., "$1,234.56", "1.234,56 EUR")
 * @returns The numeric value
 * @throws Error if value cannot be parsed as currency
 */
function parseCurrency(value: string): number {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`Cannot parse "${value}" as currency`);
  }

  // Remove all non-numeric characters except separators and minus
  const cleaned = trimmed.replace(/[^\d.,\-]/g, '');

  // Check if we have any digits
  if (!cleaned || !/\d/.test(cleaned)) {
    throw new Error(`Cannot parse "${value}" as currency`);
  }

  // Detect locale decimal separator
  const decimalSep = getLocaleDecimalSeparator();

  // Normalize to JavaScript number format
  let normalized: string;
  if (decimalSep === ',') {
    // European format: 1.234,56 -> remove dots (thousands), replace comma with dot
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // US format: 1,234.56 -> remove commas (thousands)
    normalized = cleaned.replace(/,/g, '');
  }

  const num = parseFloat(normalized);

  if (isNaN(num)) {
    throw new Error(`Cannot parse "${value}" as currency`);
  }

  return num;
}

/**
 * Parse a date string and return ISO 8601 format.
 * Accepts ISO date strings and common formats.
 *
 * @param value - Date string (e.g., "2026-02-01", "2026-02-01T15:30:00Z")
 * @returns ISO 8601 date string
 * @throws Error if value cannot be parsed as a date
 */
function parseDate(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`Cannot parse "${value}" as date`);
  }

  const date = new Date(trimmed);

  if (isNaN(date.getTime())) {
    throw new Error(`Cannot parse "${value}" as date`);
  }

  return date.toISOString();
}
