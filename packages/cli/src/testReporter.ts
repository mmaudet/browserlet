/**
 * TestReporter - Terminal output formatting for batch test execution
 *
 * Provides line-by-line colored output for batch test runs.
 * Uses picocolors for colors. No spinners -- batch output is clean
 * and non-interactive to support parallel workers and CI environments.
 */

import pc from 'picocolors';
import type { ScriptResult, BatchResult } from './batchRunner.js';

/**
 * Format a duration in milliseconds to a human-readable string.
 * - Under 1000ms: "120ms"
 * - 1s or more: "2.3s"
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * TestReporter provides colored terminal output for batch test execution.
 * Each method outputs a single console.log line, making it safe for
 * interleaved output from parallel workers.
 */
export class TestReporter {
  /**
   * Print the batch suite header.
   */
  suiteStart(directory: string, scriptCount: number): void {
    console.log('');
    console.log(
      pc.bold('  Browserlet Test') +
        pc.dim(` | ${directory} | ${scriptCount} script${scriptCount !== 1 ? 's' : ''}`),
    );
    console.log(pc.dim('  ' + '\u2500'.repeat(50)));
  }

  /**
   * Print a line indicating a script is starting.
   */
  scriptStart(scriptName: string, index: number, total: number): void {
    console.log(pc.dim(`  [${index}/${total}] Running ${scriptName}...`));
  }

  /**
   * Print the result of a single script execution.
   */
  scriptResult(result: ScriptResult): void {
    const duration = pc.dim(` (${formatDuration(result.durationMs)})`);

    if (result.exitCode === 0) {
      console.log(`  ${pc.green('PASS')} ${result.scriptName}${duration}`);
    } else if (result.exitCode === -1) {
      console.log(`  ${pc.yellow('SKIP')} ${result.scriptName}`);
    } else if (result.exitCode === 2) {
      console.log(`  ${pc.red(pc.bold('ERROR'))} ${result.scriptName}${duration}`);
      if (result.error) {
        console.log(pc.dim(`         ${result.error}`));
      }
    } else {
      console.log(`  ${pc.red('FAIL')} ${result.scriptName}${duration}`);
      if (result.error) {
        console.log(pc.dim(`         ${result.error}`));
      }
    }
  }

  /**
   * Print a summary block after all scripts have run.
   */
  summary(result: BatchResult): void {
    console.log('');
    console.log('  ' + '\u2500'.repeat(50));

    const parts: string[] = [];
    if (result.passed > 0) parts.push(pc.green(`${result.passed} passed`));
    if (result.failed > 0) parts.push(pc.red(`${result.failed} failed`));
    if (result.errored > 0) parts.push(pc.yellow(`${result.errored} errors`));
    if (result.skipped > 0) parts.push(pc.yellow(`${result.skipped} skipped`));

    const duration = formatDuration(result.totalDurationMs);
    console.log(`  Results: ${parts.join(', ')} | ${duration}`);

    // Show failure details
    const failures = result.results.filter((r) => r.exitCode > 0);
    if (failures.length > 0) {
      console.log('');
      console.log(pc.red('  Failures:'));
      failures.forEach((f, i) => {
        console.log(`    ${i + 1}) ${f.scriptName}`);
        if (f.error) {
          console.log(pc.dim(`       ${f.error}`));
        }
      });
    }

    console.log('');
  }
}
