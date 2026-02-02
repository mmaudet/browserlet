/**
 * Data extraction functions for BSL extract and table_extract actions.
 *
 * Extracts values from DOM elements with support for:
 * - Text content (default)
 * - Attributes (href, src, value, data-*)
 * - Transforms (trim, number, date, etc.)
 * - HTML tables as arrays of objects
 */

import type { OutputConfig, TableExtractionResult } from './types';
import { applyTransform } from './transforms';

/**
 * Extract value from element (textContent or attribute).
 * Returns transformed value if transform specified in output config.
 *
 * @param element - The DOM element to extract from
 * @param output - Configuration specifying what/how to extract
 * @returns The extracted value (string, number, or transformed type)
 * @throws Error if attribute not found or transform fails
 */
export function extractValue(
  element: Element,
  output: OutputConfig
): unknown {
  // Get raw value based on extraction type
  let rawValue: string;

  if (output.attribute) {
    // Extract attribute (href, src, value, data-*)
    rawValue = element.getAttribute(output.attribute) ?? '';
    if (!rawValue && output.attribute !== 'value') {
      throw new Error(
        `Attribute "${output.attribute}" not found on element`
      );
    }
  } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    // For inputs, use .value property
    rawValue = element.value;
  } else if (element instanceof HTMLSelectElement) {
    // For selects, use selected option text
    const selectedOption = element.options[element.selectedIndex];
    rawValue = selectedOption?.text ?? '';
  } else {
    // Use innerText to get only visible text (respects CSS visibility)
    // This avoids capturing hidden elements like screen-reader-only spans
    rawValue = (element as HTMLElement).innerText?.trim() ?? '';
  }

  // Apply transform if specified
  if (output.transform) {
    return applyTransform(rawValue, output.transform);
  }

  return rawValue;
}

/**
 * Extract HTML table as array of objects.
 * Headers from <th> elements, rows from <td> elements.
 *
 * @param element - The table element to extract from
 * @returns TableExtractionResult with headers array and rows array of objects
 * @throws Error if element is not a table or has no headers
 */
export function extractTable(element: Element): TableExtractionResult {
  if (!(element instanceof HTMLTableElement)) {
    throw new Error('Element must be a <table> for table_extract action');
  }

  // Extract headers from <th> elements
  // Try thead first, then fall back to first row
  const headerCells = element.querySelectorAll('thead th, tr:first-child th');
  if (headerCells.length === 0) {
    throw new Error(
      'Table must have header cells (<th>). Ensure table has <thead> or first row contains <th> elements.'
    );
  }

  // Use innerText to get only visible text (respects CSS visibility)
  const headers = Array.from(headerCells).map(th =>
    (th as HTMLElement).innerText?.trim() ?? ''
  );

  // Extract data rows from tbody or remaining tr elements
  const bodyRows = element.querySelectorAll('tbody tr');
  const dataRows = bodyRows.length > 0
    ? Array.from(bodyRows)
    : Array.from(element.querySelectorAll('tr')).slice(1); // Skip header row

  const rows = dataRows.map(row => {
    // Get both th and td cells to handle tables with row headers
    const cells = row.querySelectorAll('th, td');
    const rowData: Record<string, string> = {};

    Array.from(cells).forEach((cell, index) => {
      const header = headers[index];
      if (header) {
        // Use innerText to get only visible text (respects CSS visibility)
        // This avoids capturing hidden elements like screen-reader-only spans
        rowData[header] = (cell as HTMLElement).innerText?.trim() ?? '';
      }
    });

    return rowData;
  });

  return { headers, rows };
}
