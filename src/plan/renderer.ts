/**
 * @module plan/renderer
 *
 * Provides rendering utilities for change plans. Supports output in Markdown,
 * JSON, and plain-text terminal formats. Each renderer converts a {@link ChangePlan}
 * into a formatted string suitable for different consumption contexts.
 */

import type { ChangePlan } from '../types/index.js';

/**
 * Converts a risk level string into a bracketed uppercase badge label.
 * Known levels (`'low'`, `'medium'`, `'high'`, `'critical'`) map to their
 * predefined badges; unknown values are uppercased and wrapped in brackets.
 *
 * @param risk - The risk level string to convert.
 * @returns A badge string such as `'[LOW]'`, `'[HIGH]'`, or `'[CUSTOM]'`.
 */
function riskBadge(risk: string): string {
  const badges: Record<string, string> = {
    low: '[LOW]',
    medium: '[MEDIUM]',
    high: '[HIGH]',
    critical: '[CRITICAL]',
  };
  return badges[risk] ?? `[${risk.toUpperCase()}]`;
}

/**
 * Formats an array of strings as a newline-separated Markdown bullet list.
 * Each item is prefixed with `"- "` and optionally indented by a number of
 * two-space levels.
 *
 * @param items - The strings to render as bullet points.
 * @param indent - Number of two-space indentation levels to apply (default `0`).
 * @returns A single string with each item on its own line, prefixed with `"- "`.
 */
function bulletList(items: string[], indent: number = 0): string {
  const pad = '  '.repeat(indent);
  return items.map((item) => `${pad}- ${item}`).join('\n');
}

/**
 * Renders a change plan as a Markdown document.
 *
 * Produces a structured Markdown string with headings for summary, capability changes,
 * affected entities/modules/policies/invariants/routes, migration notes, generated
 * artifacts, tests, specs to update, human review flags, rollout notes, and open
 * questions. Sections with no items are omitted.
 *
 * @param plan - The change plan to render.
 * @returns A Markdown-formatted string representation of the change plan.
 *
 * @example
 * ```ts
 * const md = renderChangePlanMarkdown(plan);
 * fs.writeFileSync('plan.md', md);
 * ```
 */
export function renderChangePlanMarkdown(plan: ChangePlan): string {
  const lines: string[] = [];

  lines.push(`# Change Plan: ${plan.title}`);
  lines.push('');
  lines.push(`**ID:** \`${plan.id}\``);
  lines.push(`**Status:** ${plan.status}`);
  lines.push(`**Risk:** ${riskBadge(plan.risk)}`);
  lines.push(`**Author:** ${plan.author}`);
  lines.push(`**Created:** ${plan.createdAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`**Intent:** ${plan.summary.intent}`);
  lines.push(`**Scope:** ${plan.summary.scope || 'TBD'}`);
  lines.push(`**Impact Radius:** ${plan.summary.estimatedImpactRadius} affected items`);
  lines.push(`**Requires Human Review:** ${plan.summary.requiresHumanReview ? 'Yes' : 'No'}`);
  lines.push(`**Breaking Changes:** ${plan.summary.breakingChanges ? 'Yes' : 'No'}`);
  lines.push('');

  if (plan.description) {
    lines.push('## Description');
    lines.push('');
    lines.push(plan.description);
    lines.push('');
  }

  if (plan.capabilityChanges.length > 0) {
    lines.push('## Capability Changes');
    lines.push('');
    for (const change of plan.capabilityChanges) {
      const breaking = change.breakingChange ? ' **[BREAKING]**' : '';
      lines.push(`### \`${change.capability}\` — ${change.action}${breaking}`);
      lines.push('');
      lines.push(change.description);
      if (change.newEntities && change.newEntities.length > 0) {
        lines.push(`- New entities: ${change.newEntities.join(', ')}`);
      }
      if (change.newPolicies && change.newPolicies.length > 0) {
        lines.push(`- New policies: ${change.newPolicies.join(', ')}`);
      }
      if (change.newInvariants && change.newInvariants.length > 0) {
        lines.push(`- New invariants: ${change.newInvariants.join(', ')}`);
      }
      lines.push('');
    }
  }

  if (plan.affectedEntities.length > 0) {
    lines.push('## Affected Entities');
    lines.push('');
    for (const item of plan.affectedEntities) {
      lines.push(`- **${item.name}** (${item.impact}): ${item.description}`);
    }
    lines.push('');
  }

  if (plan.affectedModules.length > 0) {
    lines.push('## Affected Modules');
    lines.push('');
    for (const item of plan.affectedModules) {
      lines.push(`- **${item.name}** (${item.impact}): ${item.description}`);
    }
    lines.push('');
  }

  if (plan.affectedPolicies.length > 0) {
    lines.push('## Affected Policies');
    lines.push('');
    for (const item of plan.affectedPolicies) {
      lines.push(`- **${item.name}** (${item.impact}): ${item.description}`);
    }
    lines.push('');
  }

  if (plan.affectedInvariants.length > 0) {
    lines.push('## Affected Invariants');
    lines.push('');
    for (const item of plan.affectedInvariants) {
      lines.push(`- **${item.name}** (${item.impact}): ${item.description}`);
    }
    lines.push('');
  }

  if (plan.affectedRoutes.length > 0) {
    lines.push('## Affected Routes');
    lines.push('');
    for (const item of plan.affectedRoutes) {
      lines.push(`- **${item.name}** (${item.impact}): ${item.description}`);
    }
    lines.push('');
  }

  if (plan.migrationNotes.length > 0) {
    lines.push('## Migration Notes');
    lines.push('');
    lines.push(bulletList(plan.migrationNotes));
    lines.push('');
  }

  if (plan.generatedArtifactsToRefresh.length > 0) {
    lines.push('## Generated Artifacts to Refresh');
    lines.push('');
    lines.push(bulletList(plan.generatedArtifactsToRefresh));
    lines.push('');
  }

  if (plan.testsLikelyAffected.length > 0) {
    lines.push('## Tests Likely Affected');
    lines.push('');
    lines.push(bulletList(plan.testsLikelyAffected));
    lines.push('');
  }

  if (plan.specsToUpdate.length > 0) {
    lines.push('## Specs to Update');
    lines.push('');
    lines.push(bulletList(plan.specsToUpdate));
    lines.push('');
  }

  if (plan.humanReviewFlags.length > 0) {
    lines.push('## Human Review Flags');
    lines.push('');
    lines.push(bulletList(plan.humanReviewFlags));
    lines.push('');
  }

  if (plan.rolloutNotes.length > 0) {
    lines.push('## Rollout Notes');
    lines.push('');
    lines.push(bulletList(plan.rolloutNotes));
    lines.push('');
  }

  if (plan.openQuestions.length > 0) {
    lines.push('## Open Questions');
    lines.push('');
    lines.push(bulletList(plan.openQuestions));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Renders a change plan as a pretty-printed JSON string.
 *
 * @param plan - The change plan to render.
 * @returns A JSON string representation of the change plan with 2-space indentation.
 */
export function renderChangePlanJSON(plan: ChangePlan): string {
  return JSON.stringify(plan, null, 2);
}

/**
 * Renders a change plan as a plain-text terminal-friendly string.
 *
 * Produces a structured output with box-drawing separators, displaying plan metadata,
 * capability changes, affected items by category, and list sections (migration notes,
 * artifacts, tests, specs, review flags, rollout notes, open questions). Sections with
 * no items are omitted.
 *
 * @param plan - The change plan to render.
 * @returns A multi-line formatted string suitable for terminal/console display.
 *
 * @example
 * ```ts
 * console.log(renderChangePlanTerminal(plan));
 * ```
 */
export function renderChangePlanTerminal(plan: ChangePlan): string {
  const lines: string[] = [];
  const SEP = '═'.repeat(60);

  lines.push(SEP);
  lines.push(`CHANGE PLAN: ${plan.title}`);
  lines.push(SEP);
  lines.push('');
  lines.push(`  ID:      ${plan.id}`);
  lines.push(`  Status:  ${plan.status}`);
  lines.push(`  Risk:    ${riskBadge(plan.risk)}`);
  lines.push(`  Author:  ${plan.author}`);
  lines.push(`  Created: ${plan.createdAt}`);
  lines.push('');
  lines.push(`  Intent:  ${plan.summary.intent}`);
  lines.push(`  Scope:   ${plan.summary.scope || 'TBD'}`);
  lines.push(`  Impact:  ${plan.summary.estimatedImpactRadius} affected items`);
  lines.push(`  Review:  ${plan.summary.requiresHumanReview ? 'REQUIRED' : 'Not required'}`);
  lines.push(`  Breaking: ${plan.summary.breakingChanges ? 'YES' : 'No'}`);
  lines.push('');

  if (plan.capabilityChanges.length > 0) {
    lines.push('CAPABILITY CHANGES');
    lines.push('─'.repeat(40));
    for (const c of plan.capabilityChanges) {
      const breaking = c.breakingChange ? ' [BREAKING]' : '';
      lines.push(`  ${c.action.toUpperCase()} ${c.capability}${breaking}`);
      lines.push(`    ${c.description}`);
    }
    lines.push('');
  }

  const sections: Array<[string, { name: string; impact: string; description: string }[]]> = [
    ['AFFECTED ENTITIES', plan.affectedEntities],
    ['AFFECTED MODULES', plan.affectedModules],
    ['AFFECTED POLICIES', plan.affectedPolicies],
    ['AFFECTED INVARIANTS', plan.affectedInvariants],
    ['AFFECTED ROUTES', plan.affectedRoutes],
  ];

  for (const [heading, items] of sections) {
    if (items.length > 0) {
      lines.push(heading);
      lines.push('─'.repeat(40));
      for (const item of items) {
        lines.push(`  ${item.name} (${item.impact}): ${item.description}`);
      }
      lines.push('');
    }
  }

  const listSections: Array<[string, string[]]> = [
    ['MIGRATION NOTES', plan.migrationNotes],
    ['GENERATED ARTIFACTS TO REFRESH', plan.generatedArtifactsToRefresh],
    ['TESTS LIKELY AFFECTED', plan.testsLikelyAffected],
    ['SPECS TO UPDATE', plan.specsToUpdate],
    ['HUMAN REVIEW FLAGS', plan.humanReviewFlags],
    ['ROLLOUT NOTES', plan.rolloutNotes],
    ['OPEN QUESTIONS', plan.openQuestions],
  ];

  for (const [heading, items] of listSections) {
    if (items.length > 0) {
      lines.push(heading);
      lines.push('─'.repeat(40));
      for (const item of items) {
        lines.push(`  - ${item}`);
      }
      lines.push('');
    }
  }

  lines.push(SEP);

  return lines.join('\n');
}
