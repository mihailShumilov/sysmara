/**
 * @module cli/commands/check
 * CLI command that validates module boundary constraints: checks that modules
 * respect allowed/forbidden dependency rules, capabilities stay within their
 * owning module's scope, and no dependency cycles exist.
 */

import * as path from 'node:path';
import * as process from 'node:process';
import { parseSpecDirectory } from '../../spec/index.js';
import { validateModuleBoundaries, validateCapabilityBoundaries, detectModuleCycles } from '../../boundaries/index.js';
import type { SysmaraConfig, Diagnostic } from '../../types/index.js';
import { header, success, error, warning, section } from '../format.js';

/**
 * Validates module boundary constraints for the project.
 * Checks module dependency rules, capability boundary violations, and
 * circular dependency cycles. Reports results to stdout in text or JSON format.
 *
 * @param cwd - Current working directory (project root).
 * @param config - Resolved SysMARA project configuration.
 * @param jsonMode - When `true`, outputs machine-readable JSON instead of human-friendly text.
 * @throws Exits the process with code 1 if boundary errors or cycles are detected.
 */
export async function commandCheckBoundaries(
  cwd: string,
  config: SysmaraConfig,
  jsonMode: boolean,
): Promise<void> {
  const specDir = path.resolve(cwd, config.specDir);
  const result = await parseSpecDirectory(specDir);

  if (!result.specs) {
    console.error(error('Failed to parse specs.'));
    if (result.diagnostics.length > 0) {
      for (const d of result.diagnostics) {
        console.log(`  [${d.severity.toUpperCase()}] ${d.message}`);
      }
    }
    process.exit(1);
  }

  const specs = result.specs;

  const moduleDiags = validateModuleBoundaries(specs.modules);
  const capDiags = validateCapabilityBoundaries(specs.capabilities, specs.modules, specs.entities);
  const cycles = detectModuleCycles(specs.modules);

  const allDiags: Diagnostic[] = [...moduleDiags, ...capDiags];
  const errorCount = allDiags.filter((d) => d.severity === 'error').length;
  const warningCount = allDiags.filter((d) => d.severity === 'warning').length;

  if (jsonMode) {
    console.log(JSON.stringify({
      valid: errorCount === 0 && cycles.length === 0,
      errors: errorCount,
      warnings: warningCount,
      cycles: cycles.length,
      moduleBoundaries: moduleDiags,
      capabilityBoundaries: capDiags,
      moduleCycles: cycles.map((cycle) => cycle),
    }, null, 2));
  } else {
    console.log(header('Boundary Check'));

    if (moduleDiags.length > 0) {
      console.log(section('Module Boundaries'));
      for (const d of moduleDiags) {
        const formatter = d.severity === 'error' ? error : warning;
        console.log(`    ${formatter(d.message)}`);
        if (d.suggestion) {
          console.log(`      Suggestion: ${d.suggestion}`);
        }
      }
    }

    if (capDiags.length > 0) {
      console.log(section('Capability Boundaries'));
      for (const d of capDiags) {
        const formatter = d.severity === 'error' ? error : warning;
        console.log(`    ${formatter(d.message)}`);
        if (d.suggestion) {
          console.log(`      Suggestion: ${d.suggestion}`);
        }
      }
    }

    if (cycles.length > 0) {
      console.log(section('Module Cycles'));
      for (const cycle of cycles) {
        console.log(`    ${error(`Cycle detected: ${cycle.join(' -> ')}`)}`);
      }
    }

    console.log('');
    if (errorCount === 0 && cycles.length === 0) {
      if (warningCount > 0) {
        console.log(success(`Boundaries valid with ${warningCount} warning(s).`));
      } else {
        console.log(success('All boundaries valid. No violations or cycles detected.'));
      }
    } else {
      console.log(error(`Boundary check failed. ${errorCount} error(s), ${warningCount} warning(s), ${cycles.length} cycle(s).`));
    }
  }

  if (errorCount > 0 || cycles.length > 0) {
    process.exit(1);
  }
}
