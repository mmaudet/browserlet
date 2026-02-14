/**
 * Screenshot storage module for Browserlet
 * Stores screenshots with FIFO eviction (20 per script) and 7-day expiry
 * Follows patterns from history.ts
 */

import { storage } from './browserCompat';
import type { ScreenshotRecord } from '../types';

const SCREENSHOTS_PREFIX = 'browserlet_screenshots_';
const MAX_SCREENSHOTS_PER_SCRIPT = 20;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Get storage key for a script's screenshots
 */
function screenshotsKey(scriptId: string): string {
  return `${SCREENSHOTS_PREFIX}${scriptId}`;
}

/**
 * Get all screenshots for a script (most recent first)
 * @param scriptId - Script ID to get screenshots for
 * @returns Array of screenshot records, sorted by timestamp descending
 */
export async function getScreenshots(scriptId: string): Promise<ScreenshotRecord[]> {
  const key = screenshotsKey(scriptId);
  const result = await storage.local.get(key);
  const screenshots = (result[key] as ScreenshotRecord[] | undefined) ?? [];
  // Ensure sorted by timestamp descending (most recent first)
  return screenshots.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Save screenshot with FIFO eviction (keeps last MAX_SCREENSHOTS_PER_SCRIPT)
 * @param record - Screenshot record without id (will be generated)
 * @returns The created record with id
 */
export async function saveScreenshot(
  record: Omit<ScreenshotRecord, 'id'>
): Promise<ScreenshotRecord> {
  const key = screenshotsKey(record.scriptId);
  const screenshots = await getScreenshots(record.scriptId);

  const newRecord: ScreenshotRecord = {
    ...record,
    id: crypto.randomUUID()
  };

  // Prepend new screenshot, apply FIFO (keep last MAX_SCREENSHOTS_PER_SCRIPT)
  const updated = [newRecord, ...screenshots].slice(0, MAX_SCREENSHOTS_PER_SCRIPT);
  await storage.local.set({ [key]: updated });

  console.log('[Browserlet] Saved screenshot:', newRecord.id, 'for script:', record.scriptId);
  return newRecord;
}

/**
 * Delete a single screenshot by ID
 * @param scriptId - Script ID
 * @param screenshotId - Screenshot ID to delete
 */
export async function deleteScreenshot(
  scriptId: string,
  screenshotId: string
): Promise<void> {
  const key = screenshotsKey(scriptId);
  const screenshots = await getScreenshots(scriptId);
  const filtered = screenshots.filter(s => s.id !== screenshotId);

  if (filtered.length > 0) {
    await storage.local.set({ [key]: filtered });
  } else {
    await storage.local.remove(key);
  }

  console.log('[Browserlet] Deleted screenshot:', screenshotId);
}

/**
 * Delete all screenshots for a script
 * @param scriptId - Script ID to clear screenshots for
 */
export async function clearScreenshots(scriptId: string): Promise<void> {
  const key = screenshotsKey(scriptId);
  await storage.local.remove(key);
  console.log('[Browserlet] Cleared screenshots for script:', scriptId);
}

/**
 * Clean up screenshots older than 7 days across all scripts
 * Should be called on extension startup via alarm
 * @returns Number of screenshots deleted
 */
export async function cleanupOldScreenshots(): Promise<number> {
  const cutoff = Date.now() - MAX_AGE_MS;
  let deletedCount = 0;

  // Get all screenshot keys
  const allData = await storage.local.get(null);
  const screenshotKeys = Object.keys(allData).filter(k => k.startsWith(SCREENSHOTS_PREFIX));

  for (const key of screenshotKeys) {
    const screenshots = allData[key] as ScreenshotRecord[];
    if (!Array.isArray(screenshots)) continue;

    const fresh = screenshots.filter(s => s.timestamp > cutoff);
    const removed = screenshots.length - fresh.length;

    if (removed > 0) {
      deletedCount += removed;
      if (fresh.length > 0) {
        await storage.local.set({ [key]: fresh });
      } else {
        await storage.local.remove(key);
      }
    }
  }

  if (deletedCount > 0) {
    console.log(`[Browserlet] Cleaned up ${deletedCount} old screenshots`);
  }

  return deletedCount;
}

/**
 * Get total screenshot count across all scripts (for debugging/monitoring)
 * @returns Total number of screenshots stored
 */
export async function getTotalScreenshotCount(): Promise<number> {
  const allData = await storage.local.get(null);
  const screenshotKeys = Object.keys(allData).filter(k => k.startsWith(SCREENSHOTS_PREFIX));

  let total = 0;
  for (const key of screenshotKeys) {
    const screenshots = allData[key] as ScreenshotRecord[];
    if (Array.isArray(screenshots)) {
      total += screenshots.length;
    }
  }

  return total;
}
