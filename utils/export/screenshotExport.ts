/**
 * Screenshot export utilities for Browserlet
 * Provides individual PNG download and batch ZIP export with manifest
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { ScreenshotRecord } from '../types';

/**
 * Generate screenshot filename
 * Format: {script}-step{N}-{timestamp}.png
 */
export function generateScreenshotFilename(
  scriptName: string,
  stepIndex: number,
  timestamp: number
): string {
  const safeName = scriptName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const date = new Date(timestamp);
  const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
  const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, ''); // HHmmss
  return `${safeName}-step${stepIndex}-${dateStr}_${timeStr}.png`;
}

/**
 * Convert data URL to Blob
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64 || '');
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

/**
 * Download a single screenshot as PNG
 */
export function downloadScreenshot(
  screenshot: ScreenshotRecord,
  scriptName: string
): void {
  const filename = generateScreenshotFilename(
    scriptName,
    screenshot.stepIndex,
    screenshot.timestamp
  );
  const blob = dataUrlToBlob(screenshot.dataUrl);
  saveAs(blob, filename);
}

/**
 * Download all screenshots as ZIP with manifest.json
 * ZIP filename: {script}-screenshots-{timestamp}.zip
 */
export async function downloadAllScreenshots(
  screenshots: ScreenshotRecord[],
  scriptName: string
): Promise<void> {
  if (screenshots.length === 0) return;

  const zip = new JSZip();
  const safeName = scriptName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');

  // Create manifest with screenshot metadata
  const manifest = {
    scriptName,
    exportedAt: now.toISOString(),
    screenshotCount: screenshots.length,
    screenshots: screenshots.map(s => ({
      filename: generateScreenshotFilename(scriptName, s.stepIndex, s.timestamp),
      stepIndex: s.stepIndex,
      timestamp: new Date(s.timestamp).toISOString(),
      pageUrl: s.pageUrl,
      pageTitle: s.pageTitle,
      isFailure: s.isFailure,
      failureReason: s.failureReason || null
    }))
  };

  // Add manifest.json to ZIP
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Add each screenshot
  for (const screenshot of screenshots) {
    const filename = generateScreenshotFilename(
      scriptName,
      screenshot.stepIndex,
      screenshot.timestamp
    );
    const blob = dataUrlToBlob(screenshot.dataUrl);
    zip.file(filename, blob);
  }

  // Generate and download ZIP
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFilename = `${safeName}-screenshots-${dateStr}_${timeStr}.zip`;
  saveAs(zipBlob, zipFilename);
}
