/**
 * DiagnosticFormatter - Renders DiagnosticReport as human-readable text or JSON (DIAG-05)
 *
 * Text output goes to stderr (keeps stdout clean for JSON piping).
 * JSON output is a single valid JSON object for --diagnostic-json flag.
 */

import pc from 'picocolors';
import type { DiagnosticReport } from './types.js';

/**
 * Render a DiagnosticReport as human-readable terminal text.
 *
 * Output sections:
 * 1. Header: "FAILURE DIAGNOSTIC -- step: {stepId}"
 * 2. Confidence gap: threshold / best score / gap
 * 3. Hints searched (list with types)
 * 4. Candidate scoring matrix (if candidates exist)
 * 5. Expected vs found side-by-side (top 3 candidates)
 * 6. Suggested fix
 */
export function formatDiagnosticText(report: DiagnosticReport): string {
  const { diagnostic, suggestion } = report;
  const lines: string[] = [];

  // -- Header ----------------------------------------------------------------
  lines.push('');
  lines.push(pc.red(pc.bold('  FAILURE DIAGNOSTIC')) + pc.dim(` -- step: ${diagnostic.stepId}`));
  lines.push(pc.dim('  ' + '\u2500'.repeat(60)));

  // -- Confidence gap --------------------------------------------------------
  lines.push('');
  lines.push(pc.bold('  Confidence'));
  lines.push(
    `    Threshold:   ${pc.dim(diagnostic.confidenceThreshold.toFixed(2))}`
  );
  if (diagnostic.bestCandidateScore !== null) {
    const scoreColor = diagnostic.bestCandidateScore >= 0.60 ? pc.yellow : pc.red;
    lines.push(`    Best score:  ${scoreColor(diagnostic.bestCandidateScore.toFixed(2))}`);
    lines.push(
      `    Gap:         ${pc.red((diagnostic.confidenceGap ?? 0).toFixed(2))}` +
      pc.dim(` (${((diagnostic.confidenceGap ?? 0) * 100).toFixed(0)}% below threshold)`)
    );
  } else {
    lines.push(`    Best score:  ${pc.red('none')}${pc.dim(' (no candidates found)')}`);
  }

  // -- Hints searched --------------------------------------------------------
  lines.push('');
  lines.push(pc.bold('  Hints searched'));
  for (const hint of diagnostic.searchedHints) {
    const val = typeof hint.value === 'string'
      ? hint.value
      : `${hint.value.name}=${hint.value.value}`;
    lines.push(`    ${pc.cyan(hint.type)}${pc.dim(':')}${val}`);
  }

  // -- Candidate scoring matrix ----------------------------------------------
  if (diagnostic.topCandidates.length > 0) {
    lines.push('');
    lines.push(pc.bold('  Candidate scoring'));
    lines.push(pc.dim('  (hint rows x candidate columns; score contribution shown)'));
    lines.push('');

    const candidates = diagnostic.topCandidates.slice(0, 3);
    const allHints = candidates[0]?.hintScores ?? [];

    // Column headers: candidate index + short descriptor
    const hintColWidth = 32;
    const candColWidth = 18;

    const colHeaders = candidates.map((c, i) => {
      const tag = c.candidate.tag;
      const text = c.candidate.text.slice(0, 20) || '(no text)';
      return `C${i + 1}: ${tag} "${text}"`;
    });

    // Header row
    lines.push(
      '  ' + 'Hint'.padEnd(hintColWidth) +
      colHeaders.map(h => ('  ' + h).padEnd(candColWidth)).join('')
    );
    lines.push('  ' + '\u2500'.repeat(hintColWidth + candColWidth * candidates.length));

    // Data rows
    for (const hintScore of allHints) {
      const hintLabel = hintScore.hint.slice(0, hintColWidth - 2).padEnd(hintColWidth);
      const cells = candidates.map(cand => {
        const hs = cand.hintScores.find(s => s.hint === hintScore.hint);
        if (!hs) return pc.dim('  \u2014'.padEnd(candColWidth));
        if (hs.matched) {
          return pc.green(`  +${hs.contribution.toFixed(2)}`).padEnd(candColWidth + 10); // +10 for color escape codes
        }
        return pc.red(`   0.00`).padEnd(candColWidth + 10);
      });
      lines.push('  ' + hintLabel + cells.join(''));
    }

    // Score totals
    lines.push('  ' + '\u2500'.repeat(hintColWidth + candColWidth * candidates.length));
    const totalRow = candidates.map(c => {
      const color = c.adjustedConfidence >= 0.60 ? pc.yellow : pc.red;
      return color(`  ${c.adjustedConfidence.toFixed(2)}`).padEnd(candColWidth + 10);
    });
    lines.push('  ' + 'Total (adjusted)'.padEnd(hintColWidth) + totalRow.join(''));

    // -- Expected vs found side-by-side --------------------------------------
    lines.push('');
    lines.push(pc.bold('  Expected vs found (top candidates)'));
    lines.push('');

    const intentLine = `    Expected: ${pc.cyan(diagnostic.searchedHints.map(h => `${h.type}:${typeof h.value === 'string' ? h.value : JSON.stringify(h.value)}`).join(', '))}`;
    lines.push(intentLine);
    lines.push('');

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]!;
      const score = pc.dim(`score: ${c.adjustedConfidence.toFixed(2)}`);
      lines.push(`    ${pc.bold(`Candidate ${i + 1}`)} ${score}`);
      lines.push(`      tag:       ${pc.cyan(c.candidate.tag)}`);
      if (c.candidate.text) lines.push(`      text:      "${c.candidate.text}"`);
      const attrs = Object.entries(c.candidate.attributes)
        .map(([k, v]) => `${k}="${v}"`)
        .join(', ');
      if (attrs) lines.push(`      attrs:     ${pc.dim(attrs)}`);
      if (c.candidate.structuralContext) {
        lines.push(`      context:   ${pc.dim(c.candidate.structuralContext)}`);
      }
      lines.push('');
    }
  } else {
    lines.push('');
    lines.push(pc.dim('  No candidates found -- element does not exist on current page.'));
  }

  // -- Suggested fix ---------------------------------------------------------
  lines.push(pc.bold('  Suggested fix'));
  lines.push('');

  // Word-wrap suggestion at 70 chars
  const words = suggestion.split(' ');
  let currentLine = '    ';
  for (const word of words) {
    if (currentLine.length + word.length + 1 > 74) {
      lines.push(currentLine);
      currentLine = '    ' + word;
    } else {
      currentLine += (currentLine === '    ' ? '' : ' ') + word;
    }
  }
  if (currentLine.trim()) lines.push(currentLine);

  lines.push('');
  lines.push(pc.dim('  ' + '\u2500'.repeat(60)));
  lines.push('');

  return lines.join('\n');
}

/**
 * Render a DiagnosticReport as a JSON string for --diagnostic-json output.
 * Output is a single JSON object written to stdout.
 */
export function formatDiagnosticJSON(report: DiagnosticReport): string {
  return JSON.stringify(
    {
      step: report.diagnostic.stepId,
      page: report.diagnostic.pageUrl,
      timestamp: report.diagnostic.timestamp,
      failed_at_stage: report.diagnostic.failedAtStage,
      confidence: {
        threshold: report.diagnostic.confidenceThreshold,
        best_score: report.diagnostic.bestCandidateScore,
        gap: report.diagnostic.confidenceGap,
      },
      searched_hints: report.diagnostic.searchedHints,
      top_candidates: report.diagnostic.topCandidates.map(c => ({
        tag: c.candidate.tag,
        text: c.candidate.text,
        attributes: c.candidate.attributes,
        structural_context: c.candidate.structuralContext,
        base_confidence: c.baseConfidence,
        adjusted_confidence: c.adjustedConfidence,
        hint_scores: c.hintScores,
      })),
      suggestion: report.suggestion,
    },
    null,
    2
  );
}
