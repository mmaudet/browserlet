import { Parser } from '@json2csv/plainjs';
import { saveAs } from 'file-saver';

/**
 * Generate filename with script name, date, and time
 * Format: script-name_YYYY-MM-DD_HHmmss.ext
 */
export function generateExportFilename(scriptName: string, extension: string): string {
  const safeName = scriptName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const time = now.toTimeString().slice(0, 8).replace(/:/g, ''); // HHmmss
  return `${safeName}_${date}_${time}.${extension}`;
}

/**
 * Get locale-appropriate CSV delimiter
 * European locales use semicolon (comma is decimal separator)
 */
export function getCSVDelimiter(locale?: string): string {
  const lang = (locale || navigator.language || 'en-US').split('-')[0].toLowerCase();
  const europeanLangs = ['fr', 'de', 'es', 'it', 'nl', 'pt', 'pl', 'sv', 'no', 'da', 'fi'];
  return europeanLangs.includes(lang) ? ';' : ',';
}

/**
 * Export data to JSON file
 */
export function exportToJSON(
  data: Record<string, unknown>,
  scriptName: string
): void {
  const filename = generateExportFilename(scriptName, 'json');
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  saveAs(blob, filename);
}

/**
 * Export data to CSV file with locale-aware delimiter
 * Handles both flat objects and arrays (for table_extract results)
 */
export function exportToCSV(
  data: Record<string, unknown>,
  scriptName: string
): void {
  const filename = generateExportFilename(scriptName, 'csv');
  const delimiter = getCSVDelimiter();

  // Flatten data for CSV: simple values become rows, arrays expand
  const rows = flattenForCSV(data);

  const parser = new Parser({
    delimiter,
    withBOM: true, // UTF-8 BOM for Excel compatibility
  });

  const csv = parser.parse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  saveAs(blob, filename);
}

/**
 * Flatten extracted data for CSV export
 * Handles mix of simple values, table arrays, and table_extract format
 */
function flattenForCSV(data: Record<string, unknown>): Record<string, string>[] {
  const rows: Record<string, string>[] = [];

  for (const [key, value] of Object.entries(data)) {
    // Check for table_extract format: { headers: [], rows: [] }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const tableData = value as { headers?: string[]; rows?: Record<string, string>[] };
      if (tableData.headers && tableData.rows && Array.isArray(tableData.rows)) {
        // table_extract format - use rows directly with headers
        tableData.rows.forEach((row, index) => {
          const prefixedRow: Record<string, string> = {
            _source: key,
            _row: String(index + 1),
          };
          for (const header of tableData.headers!) {
            prefixedRow[header] = row[header] || '';
          }
          rows.push(prefixedRow);
        });
        continue;
      }
    }

    if (Array.isArray(value)) {
      // Table data - each row gets variable name prefix
      value.forEach((row, index) => {
        if (typeof row === 'object' && row !== null) {
          const prefixedRow: Record<string, string> = {
            _source: key,
            _row: String(index + 1),
          };
          for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
            prefixedRow[k] = String(v);
          }
          rows.push(prefixedRow);
        }
      });
    } else {
      // Simple value - single row
      rows.push({
        variable: key,
        value: String(value),
      });
    }
  }

  return rows;
}
