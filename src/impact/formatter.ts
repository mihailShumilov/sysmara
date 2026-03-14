import type { ImpactSurface } from '../types/index.js';

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
    impact.affectedFlows.length;

  lines.push(SEP);
  lines.push(`  Total Impact Radius: ${totalAffected} nodes`);
  lines.push(SEP);

  return lines.join('\n');
}

export function formatImpactJSON(impact: ImpactSurface): string {
  return JSON.stringify(impact, null, 2);
}
