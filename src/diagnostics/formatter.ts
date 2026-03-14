/**
 * @module diagnostics/formatter
 *
 * Formatting utilities for rendering a {@link DiagnosticsReport} as either
 * human-readable terminal output or structured JSON.
 */

import type { DiagnosticsReport } from '../types/index.js';

const SEPARATOR = '\u2550'.repeat(39);

function severityLabel(severity: string): string {
  switch (severity) {
    case 'error':
      return 'ERROR';
    case 'warning':
      return 'WARNING';
    case 'info':
      return 'INFO';
    default:
      return severity.toUpperCase();
  }
}

/**
 * Formats a diagnostics report as a human-readable string suitable for terminal output.
 *
 * The output includes a summary header with error/warning/info counts, followed by
 * each diagnostic rendered with its severity label, code, message, source, path
 * (if present), and suggestion (if present).
 *
 * @param report - The diagnostics report to format.
 * @returns A multi-line string ready for printing to a terminal.
 *
 * @example
 * ```ts
 * const report = runDiagnostics(specs);
 * console.log(formatDiagnosticsTerminal(report));
 * ```
 */
export function formatDiagnosticsTerminal(report: DiagnosticsReport): string {
  const lines: string[] = [];

  lines.push('SYSMARA DIAGNOSTICS');
  lines.push(SEPARATOR);
  lines.push('');
  lines.push(
    `Errors: ${report.totalErrors} | Warnings: ${report.totalWarnings} | Info: ${report.totalInfo}`,
  );
  lines.push('');

  for (const d of report.diagnostics) {
    const label = severityLabel(d.severity);
    lines.push(`${label} [${d.code}] ${d.message}`);
    lines.push(`  \u2192 source: ${d.source}`);
    if (d.path) {
      lines.push(`  \u2192 path: ${d.path}`);
    }
    if (d.suggestion) {
      lines.push(`  \u2192 suggestion: ${d.suggestion}`);
    }
    lines.push('');
  }

  lines.push(SEPARATOR);

  return lines.join('\n');
}

/**
 * Formats a diagnostics report as a pretty-printed JSON string.
 *
 * @param report - The diagnostics report to format.
 * @returns A JSON string with 2-space indentation representing the full report.
 *
 * @example
 * ```ts
 * const report = runDiagnostics(specs);
 * await fs.writeFile('diagnostics.json', formatDiagnosticsJSON(report));
 * ```
 */
export function formatDiagnosticsJSON(report: DiagnosticsReport): string {
  return JSON.stringify(report, null, 2);
}
