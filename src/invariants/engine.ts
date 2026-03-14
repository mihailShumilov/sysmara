import type {
  InvariantSpec,
  EntitySpec,
  CapabilitySpec,
  Diagnostic,
} from '../types/index.js';

export interface InvariantCheck {
  invariant: string;
  entity: string;
  passed: boolean;
  message: string;
}

export function validateInvariantSpecs(
  invariants: InvariantSpec[],
  entities: EntitySpec[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const entityNames = new Set(entities.map((e) => e.name));
  const seenNames = new Set<string>();

  for (const invariant of invariants) {
    // Check for duplicate invariant names
    if (seenNames.has(invariant.name)) {
      diagnostics.push({
        code: 'INV_DUPLICATE_NAME',
        severity: 'error',
        message: `Duplicate invariant name: "${invariant.name}"`,
        source: `invariant:${invariant.name}`,
        path: `invariants.${invariant.name}`,
        suggestion: `Rename one of the duplicate invariants named "${invariant.name}"`,
      });
    }
    seenNames.add(invariant.name);

    // Check each invariant references a valid entity
    if (!entityNames.has(invariant.entity)) {
      diagnostics.push({
        code: 'INV_UNDEFINED_ENTITY',
        severity: 'error',
        message: `Invariant "${invariant.name}" references undefined entity "${invariant.entity}"`,
        source: `invariant:${invariant.name}`,
        path: `invariants.${invariant.name}.entity`,
        suggestion: `Define entity "${invariant.entity}" or update invariant "${invariant.name}" to reference an existing entity`,
      });
    }

    // Check severity is valid
    const validSeverities = ['error', 'warning'];
    if (!validSeverities.includes(invariant.severity)) {
      diagnostics.push({
        code: 'INV_INVALID_SEVERITY',
        severity: 'error',
        message: `Invariant "${invariant.name}" has invalid severity "${invariant.severity}". Must be "error" or "warning"`,
        source: `invariant:${invariant.name}`,
        path: `invariants.${invariant.name}.severity`,
        suggestion: `Set severity to "error" or "warning"`,
      });
    }
  }

  return diagnostics;
}

export function resolveInvariantsForEntity(
  entityName: string,
  invariants: InvariantSpec[],
): InvariantSpec[] {
  return invariants.filter((inv) => inv.entity === entityName);
}

export function resolveInvariantsForCapability(
  capabilityName: string,
  capabilities: CapabilitySpec[],
  invariants: InvariantSpec[],
): InvariantSpec[] {
  const capability = capabilities.find((c) => c.name === capabilityName);
  if (!capability) {
    return [];
  }

  const invariantNames = new Set(capability.invariants);
  return invariants.filter((inv) => invariantNames.has(inv.name));
}
