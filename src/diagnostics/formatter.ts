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

export function formatDiagnosticsJSON(report: DiagnosticsReport): string {
  return JSON.stringify(report, null, 2);
}
