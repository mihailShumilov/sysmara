/**
 * @module invariants/engine
 *
 * Invariant validation engine for the AI-first framework. Validates invariant
 * specifications against entity definitions, and resolves which invariants apply
 * to a given entity or capability.
 */

import type {
  InvariantSpec,
  EntitySpec,
  CapabilitySpec,
  Diagnostic,
} from '../types/index.js';

/**
 * Represents the result of checking a single invariant against an entity.
 *
 * @property invariant - The name of the invariant that was checked.
 * @property entity - The name of the entity the invariant was checked against.
 * @property passed - Whether the invariant check passed.
 * @property message - A human-readable message describing the check result.
 */
export interface InvariantCheck {
  invariant: string;
  entity: string;
  passed: boolean;
  message: string;
}

/**
 * Validates invariant specifications for correctness and consistency.
 *
 * Checks for:
 * - Duplicate invariant names (produces `INV_DUPLICATE_NAME` errors)
 * - References to undefined entities (produces `INV_UNDEFINED_ENTITY` errors)
 * - Invalid severity values (produces `INV_INVALID_SEVERITY` errors; must be `'error'` or `'warning'`)
 *
 * @param invariants - The list of invariant specifications to validate.
 * @param entities - The list of known entity specifications to validate references against.
 * @returns An array of {@link Diagnostic} objects describing any validation issues found.
 *   Returns an empty array if all invariants are valid.
 *
 * @example
 * ```ts
 * const diagnostics = validateInvariantSpecs(specs.invariants, specs.entities);
 * if (diagnostics.length > 0) {
 *   console.error('Invariant validation failed:', diagnostics);
 * }
 * ```
 */
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

/**
 * Resolves all invariants that apply to a specific entity by name.
 *
 * Filters the full list of invariants to return only those whose `entity` field
 * matches the given entity name.
 *
 * @param entityName - The name of the entity to find invariants for.
 * @param invariants - The full list of invariant specifications to search.
 * @returns An array of {@link InvariantSpec} objects that apply to the specified entity.
 *
 * @example
 * ```ts
 * const orderInvariants = resolveInvariantsForEntity('Order', specs.invariants);
 * ```
 */
export function resolveInvariantsForEntity(
  entityName: string,
  invariants: InvariantSpec[],
): InvariantSpec[] {
  return invariants.filter((inv) => inv.entity === entityName);
}

/**
 * Resolves all invariants associated with a specific capability.
 *
 * Looks up the capability by name, then filters invariants to return only those
 * listed in the capability's `invariants` array. Returns an empty array if the
 * capability is not found.
 *
 * @param capabilityName - The name of the capability to find invariants for.
 * @param capabilities - The full list of capability specifications to search.
 * @param invariants - The full list of invariant specifications to filter.
 * @returns An array of {@link InvariantSpec} objects referenced by the specified capability.
 *
 * @example
 * ```ts
 * const capInvariants = resolveInvariantsForCapability('createOrder', specs.capabilities, specs.invariants);
 * ```
 */
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
