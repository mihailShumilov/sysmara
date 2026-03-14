/**
 * @module cli/commands/validate
 * CLI command that validates all SysMARA spec files by parsing them and
 * running cross-validation to detect broken references, missing fields,
 * and other structural issues.
 */

import * as path from 'node:path';
import * as process from 'node:process';
import { parseSpecDirectory, crossValidate } from '../../spec/index.js';
import type { SysmaraConfig, Diagnostic } from '../../types/index.js';
import { header, success, error, warning, info, table } from '../format.js';

function formatDiagnosticsList(diagnostics: Diagnostic[]): void {
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  const infos = diagnostics.filter((d) => d.severity === 'info');

  if (errors.length > 0) {
    console.log(`\n  Errors (${errors.length}):`);
    for (const d of errors) {
      console.log(`    ${error(d.message)}`);
      if (d.suggestion) {
        console.log(`      Suggestion: ${d.suggestion}`);
      }
    }
  }

  if (warnings.length > 0) {
    console.log(`\n  Warnings (${warnings.length}):`);
    for (const d of warnings) {
      console.log(`    ${warning(d.message)}`);
      if (d.suggestion) {
        console.log(`      Suggestion: ${d.suggestion}`);
      }
    }
  }

  if (infos.length > 0) {
    console.log(`\n  Info (${infos.length}):`);
    for (const d of infos) {
      console.log(`    ${info(d.message)}`);
    }
  }
}

/**
 * Parses all spec files and runs cross-validation, reporting parse errors,
 * broken references, and structural issues. Displays a summary table of
 * spec counts along with categorized diagnostics.
 *
 * @param cwd - Current working directory (project root).
 * @param config - Resolved SysMARA project configuration.
 * @param jsonMode - When `true`, outputs a structured JSON validation report.
 * @throws Exits the process with code 1 if parsing fails or validation errors are found.
 */
export async function commandValidate(cwd: string, config: SysmaraConfig, jsonMode: boolean): Promise<void> {
  const specDir = path.resolve(cwd, config.specDir);

  const result = await parseSpecDirectory(specDir);

  if (result.diagnostics.length > 0 && !jsonMode) {
    console.log(header('Parse Diagnostics'));
    formatDiagnosticsList(result.diagnostics);
  }

  if (!result.specs) {
    if (jsonMode) {
      console.log(JSON.stringify({ valid: false, parseErrors: result.diagnostics }, null, 2));
    } else {
      console.error(error('Failed to parse specs. Fix the errors above and try again.'));
    }
    process.exit(1);
  }

  const crossDiags = crossValidate(result.specs);
  const allDiags = [...result.diagnostics, ...crossDiags];
  const errorCount = allDiags.filter((d) => d.severity === 'error').length;
  const warningCount = allDiags.filter((d) => d.severity === 'warning').length;

  if (jsonMode) {
    console.log(JSON.stringify({
      valid: errorCount === 0,
      errors: errorCount,
      warnings: warningCount,
      diagnostics: allDiags,
      specs: {
        entities: result.specs.entities.length,
        capabilities: result.specs.capabilities.length,
        policies: result.specs.policies.length,
        invariants: result.specs.invariants.length,
        modules: result.specs.modules.length,
        flows: result.specs.flows.length,
      },
    }, null, 2));
  } else {
    console.log(header('Validation Results'));
    console.log('');

    const rows = [
      ['Entities', String(result.specs.entities.length)],
      ['Capabilities', String(result.specs.capabilities.length)],
      ['Policies', String(result.specs.policies.length)],
      ['Invariants', String(result.specs.invariants.length)],
      ['Modules', String(result.specs.modules.length)],
      ['Flows', String(result.specs.flows.length)],
    ];
    console.log(table(['Spec Type', 'Count'], rows));

    if (crossDiags.length > 0) {
      console.log(header('Cross-Validation'));
      formatDiagnosticsList(crossDiags);
    }

    console.log('');
    if (errorCount === 0) {
      console.log(success(`Validation passed. ${warningCount} warning(s).`));
    } else {
      console.log(error(`Validation failed. ${errorCount} error(s), ${warningCount} warning(s).`));
    }
  }

  if (errorCount > 0) {
    process.exit(1);
  }
}
