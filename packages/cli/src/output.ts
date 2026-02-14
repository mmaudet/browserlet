/**
 * StepReporter - Terminal output formatting for BSL script execution
 *
 * Provides colored output with spinners for step-by-step progress,
 * using picocolors for colors and ora for spinner animations.
 */

import pc from 'picocolors';
import ora, { type Ora } from 'ora';

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
 * StepReporter provides colored terminal output with spinner support
 * for BSL script execution feedback.
 */
export class StepReporter {
  private spinner: Ora | null = null;

  /**
   * Print a script execution header.
   */
  scriptStart(scriptName: string, totalSteps: number): void {
    console.log('');
    console.log(
      pc.bold(`  Browserlet`) +
        pc.dim(` | ${scriptName} | ${totalSteps} step${totalSteps !== 1 ? 's' : ''}`),
    );
    console.log(pc.dim('  ' + '-'.repeat(50)));
  }

  /**
   * Start a spinner for a new step.
   */
  stepStart(stepIndex: number, totalSteps: number, action: string, target: string): void {
    const prefix = pc.dim(`  [${stepIndex + 1}/${totalSteps}]`);
    const actionLabel = pc.bold(action);
    const targetLabel = target ? pc.dim(` ${truncate(target, 50)}`) : '';

    this.spinner = ora({
      text: `${prefix} ${actionLabel}${targetLabel}`,
      prefixText: '',
      indent: 2,
    }).start();
  }

  /**
   * Mark the current step as passed with a green checkmark and duration.
   */
  stepPass(durationMs: number): void {
    if (this.spinner) {
      const duration = pc.dim(` (${formatDuration(durationMs)})`);
      this.spinner.succeed(this.spinner.text + duration);
      this.spinner = null;
    }
  }

  /**
   * Mark the current step as failed with a red X and error message.
   * Optionally displays the path to a failure screenshot.
   */
  stepFail(error: string, screenshotPath?: string): void {
    if (this.spinner) {
      let message = this.spinner.text + pc.red(` -- ${error}`);
      if (screenshotPath) {
        message += '\n' + pc.dim(`      Screenshot: ${screenshotPath}`);
      }
      this.spinner.fail(message);
      this.spinner = null;
    }
  }

  /**
   * Print a green success summary after all steps pass.
   */
  scriptPass(totalDurationMs: number): void {
    console.log('');
    console.log(
      pc.green(pc.bold('  PASS')) +
        pc.dim(` | completed in ${formatDuration(totalDurationMs)}`),
    );
    console.log('');
  }

  /**
   * Print a red failure summary when a step fails.
   */
  scriptFail(failedStep: number, error: string): void {
    console.log('');
    console.log(
      pc.red(pc.bold('  FAIL')) +
        pc.dim(` | step ${failedStep}`) +
        pc.red(` -- ${error}`),
    );
    console.log('');
  }
}

/**
 * Truncate a string to maxLength, adding ellipsis if needed.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
