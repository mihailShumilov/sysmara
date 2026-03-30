/**
 * @module impact/formatter
 *
 * Provides formatting utilities for rendering {@link ImpactSurface} analysis results
 * as human-readable terminal output or structured JSON.
 */

import type { ImpactSurface } from '../types/index.js';

/**
 * Formats an impact analysis result as a human-readable terminal string.
 *
 * Renders the impact surface with box-drawing separators, categorized sections
 * for each affected node type (modules, capabilities, invariants, policies, routes,
 * flows, tests, generated artifacts), and a total impact radius summary.
 * Sections with no affected items display "none".
 *
 * @param impact - The impact surface analysis result to format.
 * @returns A multi-line formatted string suitable for terminal/console display.
 *
 * @example
 * ```ts
 * const impact = analyzeImpact(graph, 'capability:createOrder');
 * if (impact) {
 *   console.log(formatImpactTerminal(impact));
 * }
 * ```
 */
export function formatImpactTerminal(impact: ImpactSurface): string {
  const lines: string[] = [];
  const SEP = '═'.repeat(60);

  lines.push(SEP);
  lines.push(`IMPACT ANALYSIS: ${impact.target}`);
  lines.push(SEP);
  lines.push('');
  lines.push(`  Target Type: ${impact.targetType}`);
  lines.push('');

  const sections: Array<[string, string[]]> = [
    ['Affected Modules', impact.affectedModules],
    ['Affected Capabilities', impact.affectedCapabilities],
    ['Affected Invariants', impact.affectedInvariants],
    ['Affected Policies', impact.affectedPolicies],
    ['Affected Routes', impact.affectedRoutes],
    ['Affected Flows', impact.affectedFlows],
    ['Affected Files', impact.affectedFiles],
    ['Tests Likely Affected', impact.affectedTests],
    ['Generated Artifacts', impact.generatedArtifacts],
  ];

  for (const [heading, items] of sections) {
    if (items.length > 0) {
      lines.push(`  ${heading} (${items.length}):`);
      for (const item of items) {
        lines.push(`    - ${item}`);
      }
      lines.push('');
    } else {
      lines.push(`  ${heading}: none`);
    }
  }

  const totalAffected =
    impact.affectedModules.length +
    impact.affectedCapabilities.length +
    impact.affectedInvariants.length +
    impact.affectedPolicies.length +
    impact.affectedRoutes.length +
    impact.affectedFlows.length +
    impact.affectedFiles.length;

  lines.push(SEP);
  lines.push(`  Total Impact Radius: ${totalAffected} nodes`);
  lines.push(SEP);

  return lines.join('\n');
}

/**
 * Formats an impact analysis result as a pretty-printed JSON string.
 *
 * @param impact - The impact surface analysis result to format.
 * @returns A JSON string representation of the impact surface with 2-space indentation.
 *
 * @example
 * ```ts
 * const json = formatImpactJSON(impact);
 * fs.writeFileSync('impact-report.json', json);
 * ```
 */
export function formatImpactJSON(impact: ImpactSurface): string {
  return JSON.stringify(impact, null, 2);
}
