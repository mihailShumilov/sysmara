import { createHash } from 'node:crypto';
import type {
  ChangePlan,
  CapabilityChange,
  AffectedItem,
  SystemSpecs,
  SystemGraph,
  ImpactSurface,
  RiskLevel,
} from '../types/index.js';
import { analyzeImpact } from '../impact/analyzer.js';

export interface PlanRequest {
  title: string;
  description: string;
  author?: string;
  capabilityChanges: Array<{
    capability: string;
    action: 'add' | 'modify' | 'remove' | 'rename';
    description: string;
    newEntities?: string[];
    newPolicies?: string[];
    newInvariants?: string[];
    breakingChange?: boolean;
  }>;
}

function generatePlanId(title: string, timestamp: string): string {
  const hash = createHash('sha256')
    .update(`${title}:${timestamp}`)
    .digest('hex')
    .slice(0, 12);
  return `plan-${hash}`;
}

function classifyRisk(
  impacts: ImpactSurface[],
  changes: CapabilityChange[],
): RiskLevel {
  const hasBreaking = changes.some((c) => c.breakingChange);
  const totalAffected = impacts.reduce(
    (sum, i) =>
      sum +
      i.affectedModules.length +
      i.affectedCapabilities.length +
      i.affectedInvariants.length +
      i.affectedPolicies.length,
    0,
  );
  const hasRemovals = changes.some((c) => c.action === 'remove');

  if (hasBreaking && hasRemovals) return 'critical';
  if (hasBreaking || totalAffected > 10) return 'high';
  if (totalAffected > 5 || hasRemovals) return 'medium';
  return 'low';
}

function collectAffectedItems(
  impacts: ImpactSurface[],
  field: 'affectedModules' | 'affectedInvariants' | 'affectedPolicies' | 'affectedCapabilities' | 'affectedRoutes' | 'affectedFlows',
  targetNames: Set<string>,
): AffectedItem[] {
  const seen = new Set<string>();
  const items: AffectedItem[] = [];

  for (const impact of impacts) {
    for (const name of impact[field]) {
      if (!seen.has(name)) {
        seen.add(name);
        items.push({
          name,
          impact: targetNames.has(name) ? 'direct' : 'indirect',
          description: `Affected via ${impact.target}`,
        });
      }
    }
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export function generateChangePlan(
  request: PlanRequest,
  specs: SystemSpecs,
  graph: SystemGraph,
): ChangePlan {
  const timestamp = new Date().toISOString();
  const planId = generatePlanId(request.title, timestamp);

  const capabilityChanges: CapabilityChange[] = request.capabilityChanges.map(
    (c) => ({
      capability: c.capability,
      action: c.action,
      description: c.description,
      newEntities: c.newEntities,
      newPolicies: c.newPolicies,
      newInvariants: c.newInvariants,
      breakingChange: c.breakingChange ?? false,
    }),
  );

  // Gather impact analysis for each referenced capability
  const impacts: ImpactSurface[] = [];
  const targetNames = new Set<string>();

  for (const change of capabilityChanges) {
    targetNames.add(change.capability);
    const capTarget = `capability:${change.capability}`;
    const impact = analyzeImpact(graph, capTarget, specs);
    if (impact) {
      impacts.push(impact);
    }

    // Also analyze new entities
    for (const entity of change.newEntities ?? []) {
      const entityTarget = `entity:${entity}`;
      const entityImpact = analyzeImpact(graph, entityTarget, specs);
      if (entityImpact) {
        impacts.push(entityImpact);
      }
    }
  }

  // Collect affected items from all impacts
  const affectedEntities: AffectedItem[] = [];
  const entitySeen = new Set<string>();
  for (const impact of impacts) {
    if (impact.targetType === 'entity' && !entitySeen.has(impact.target)) {
      entitySeen.add(impact.target);
      affectedEntities.push({
        name: impact.target.replace('entity:', ''),
        impact: 'direct',
        description: 'Directly targeted by change',
      });
    }
  }
  // Add entities referenced by capabilities
  for (const change of capabilityChanges) {
    const cap = specs.capabilities.find((c) => c.name === change.capability);
    if (cap) {
      for (const ent of cap.entities) {
        if (!entitySeen.has(ent)) {
          entitySeen.add(ent);
          affectedEntities.push({
            name: ent,
            impact: 'direct',
            description: `Used by capability ${change.capability}`,
          });
        }
      }
    }
    for (const ent of change.newEntities ?? []) {
      if (!entitySeen.has(ent)) {
        entitySeen.add(ent);
        affectedEntities.push({
          name: ent,
          impact: 'direct',
          description: `New entity introduced by ${change.capability}`,
        });
      }
    }
  }
  affectedEntities.sort((a, b) => a.name.localeCompare(b.name));

  const affectedModules = collectAffectedItems(impacts, 'affectedModules', targetNames);
  const affectedPolicies = collectAffectedItems(impacts, 'affectedPolicies', targetNames);
  const affectedInvariants = collectAffectedItems(impacts, 'affectedInvariants', targetNames);
  const affectedRoutes = collectAffectedItems(impacts, 'affectedRoutes', targetNames);

  // Also add modules from capabilities directly
  for (const change of capabilityChanges) {
    const cap = specs.capabilities.find((c) => c.name === change.capability);
    if (cap && !affectedModules.some((m) => m.name === cap.module)) {
      affectedModules.push({
        name: cap.module,
        impact: 'direct',
        description: `Module owning capability ${change.capability}`,
      });
    }
  }
  affectedModules.sort((a, b) => a.name.localeCompare(b.name));

  // Collect test paths
  const testsLikelyAffected = [
    ...new Set(impacts.flatMap((i) => i.affectedTests)),
  ].sort();

  // Collect generated artifacts
  const generatedArtifactsToRefresh = [
    ...new Set(impacts.flatMap((i) => i.generatedArtifacts)),
  ].sort();

  // Determine specs to update
  const specsToUpdate: string[] = [];
  for (const change of capabilityChanges) {
    specsToUpdate.push('system/capabilities.yaml');
    if (change.action === 'add') {
      specsToUpdate.push('system/modules.yaml');
    }
    if ((change.newEntities?.length ?? 0) > 0) {
      specsToUpdate.push('system/entities.yaml');
    }
    if ((change.newPolicies?.length ?? 0) > 0) {
      specsToUpdate.push('system/policies.yaml');
    }
    if ((change.newInvariants?.length ?? 0) > 0) {
      specsToUpdate.push('system/invariants.yaml');
    }
  }
  const uniqueSpecs = [...new Set(specsToUpdate)].sort();

  // Risk classification
  const risk = classifyRisk(impacts, capabilityChanges);

  // Human review flags
  const humanReviewFlags: string[] = [];
  if (capabilityChanges.some((c) => c.breakingChange)) {
    humanReviewFlags.push('Contains breaking changes — requires human review');
  }
  if (capabilityChanges.some((c) => c.action === 'remove')) {
    humanReviewFlags.push('Removes capabilities — verify no external consumers');
  }
  if (affectedInvariants.length > 0) {
    humanReviewFlags.push(
      `Affects ${affectedInvariants.length} invariant(s) — verify constraints still hold`,
    );
  }
  if (risk === 'critical' || risk === 'high') {
    humanReviewFlags.push(`Risk level: ${risk} — manual approval recommended`);
  }

  const totalImpactRadius =
    affectedEntities.length +
    affectedModules.length +
    affectedPolicies.length +
    affectedInvariants.length +
    affectedRoutes.length;

  return {
    id: planId,
    title: request.title,
    description: request.description,
    createdAt: timestamp,
    author: request.author ?? 'ai-agent',
    status: 'draft',
    risk,
    summary: {
      intent: request.description,
      scope: affectedModules.map((m) => m.name).join(', ') || 'unknown',
      estimatedImpactRadius: totalImpactRadius,
      requiresHumanReview: humanReviewFlags.length > 0,
      breakingChanges: capabilityChanges.some((c) => c.breakingChange),
    },
    capabilityChanges,
    affectedEntities,
    affectedModules,
    affectedPolicies,
    affectedInvariants,
    affectedRoutes,
    migrationNotes: [],
    generatedArtifactsToRefresh,
    testsLikelyAffected,
    specsToUpdate: uniqueSpecs,
    humanReviewFlags,
    rolloutNotes: [],
    openQuestions: [],
  };
}

export function createEmptyPlan(
  title: string,
  description: string,
  author?: string,
): ChangePlan {
  const timestamp = new Date().toISOString();
  const planId = generatePlanId(title, timestamp);

  return {
    id: planId,
    title,
    description,
    createdAt: timestamp,
    author: author ?? 'ai-agent',
    status: 'draft',
    risk: 'low',
    summary: {
      intent: description,
      scope: '',
      estimatedImpactRadius: 0,
      requiresHumanReview: false,
      breakingChanges: false,
    },
    capabilityChanges: [],
    affectedEntities: [],
    affectedModules: [],
    affectedPolicies: [],
    affectedInvariants: [],
    affectedRoutes: [],
    migrationNotes: [],
    generatedArtifactsToRefresh: [],
    testsLikelyAffected: [],
    specsToUpdate: [],
    humanReviewFlags: [],
    rolloutNotes: [],
    openQuestions: [],
  };
}
