/**
 * @module diagnostics/engine
 *
 * Core diagnostics engine for Sysmara system specifications. Performs six
 * categories of validation checks (AX1xx through AX6xx) covering duplicate
 * names, reference resolution, boundary violations, orphan detection,
 * safety/manifest consistency, and general consistency rules. All checks
 * are aggregated into a single {@link DiagnosticsReport}.
 */

import type {
  SystemSpecs,
  GeneratedManifest,
  Diagnostic,
  DiagnosticsReport,
  DiagnosticSeverity,
  ModuleSpec,
} from '../types/index.js';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Creates a {@link Diagnostic} object with the given properties, omitting
 * optional fields (`path`, `suggestion`) when they are not provided.
 *
 * @param code - The diagnostic code (e.g., `'AX101'`).
 * @param severity - The severity level of the diagnostic.
 * @param message - A human-readable description of the issue.
 * @param source - The specification section that produced this diagnostic (e.g., `'entities'`).
 * @param path - An optional dot-delimited path pinpointing the offending declaration.
 * @param suggestion - An optional recommended action to resolve the issue.
 * @returns A fully constructed {@link Diagnostic} object.
 */
function diag(
  code: string,
  severity: DiagnosticSeverity,
  message: string,
  source: string,
  path?: string,
  suggestion?: string,
): Diagnostic {
  const d: Diagnostic = { code, severity, message, source };
  if (path !== undefined) d.path = path;
  if (suggestion !== undefined) d.suggestion = suggestion;
  return d;
}

/**
 * Extracts the `name` property from each item and returns them as a `Set`
 * for O(1) membership lookups.
 *
 * @param items - An array of objects that each have a `name` property.
 * @returns A `Set` containing all unique names from the input array.
 */
function nameSet(items: { name: string }[]): Set<string> {
  return new Set(items.map((i) => i.name));
}

// ── AX1xx: Duplicate Names ──────────────────────────────────────────

/**
 * Checks for duplicate names within each specification category (AX1xx).
 *
 * Iterates over entities, capabilities, policies, invariants, modules, and flows,
 * emitting an error diagnostic for every name that appears more than once within
 * the same category.
 *
 * @param specs - The system specifications to validate.
 * @returns An array of diagnostics for any duplicate names found (codes AX101--AX106).
 */
function checkDuplicates(specs: SystemSpecs): Diagnostic[] {
  const results: Diagnostic[] = [];

  const checks: Array<{
    code: string;
    label: string;
    source: string;
    items: { name: string }[];
  }> = [
    { code: 'AX101', label: 'entity', source: 'entities', items: specs.entities },
    { code: 'AX102', label: 'capability', source: 'capabilities', items: specs.capabilities },
    { code: 'AX103', label: 'policy', source: 'policies', items: specs.policies },
    { code: 'AX104', label: 'invariant', source: 'invariants', items: specs.invariants },
    { code: 'AX105', label: 'module', source: 'modules', items: specs.modules },
    { code: 'AX106', label: 'flow', source: 'flows', items: specs.flows },
  ];

  for (const { code, label, source, items } of checks) {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.name)) {
        results.push(
          diag(
            code,
            'error',
            `Duplicate ${label} name '${item.name}'`,
            source,
            undefined,
            `Rename or remove the duplicate ${label} '${item.name}'`,
          ),
        );
      }
      seen.add(item.name);
    }
  }

  return results;
}

// ── AX2xx: Reference Resolution ─────────────────────────────────────

/**
 * Validates that all cross-references between specification items resolve to
 * defined targets (AX2xx).
 *
 * Covers the following reference paths:
 * - AX201: Capability -> Entity
 * - AX202: Capability -> Policy
 * - AX203: Capability -> Invariant
 * - AX204: Policy -> Capability
 * - AX205: Invariant -> Entity
 * - AX206: Flow trigger -> Capability
 * - AX207: Flow step action -> Capability
 * - AX208: Module -> Entity
 * - AX209: Module -> Capability
 *
 * @param specs - The system specifications to validate.
 * @returns An array of error diagnostics for every unresolved reference found.
 */
function checkReferences(specs: SystemSpecs): Diagnostic[] {
  const results: Diagnostic[] = [];
  const entityNames = nameSet(specs.entities);
  const capabilityNames = nameSet(specs.capabilities);
  const policyNames = nameSet(specs.policies);
  const invariantNames = nameSet(specs.invariants);

  // AX201: Capability references undefined entity
  for (const cap of specs.capabilities) {
    for (const entityRef of cap.entities) {
      if (!entityNames.has(entityRef)) {
        results.push(
          diag(
            'AX201',
            'error',
            `Capability '${cap.name}' references undefined entity '${entityRef}'`,
            'capabilities',
            `capabilities.${cap.name}.entities`,
            `Define entity '${entityRef}' or fix the reference`,
          ),
        );
      }
    }
  }

  // AX202: Capability references undefined policy
  for (const cap of specs.capabilities) {
    for (const policyRef of cap.policies) {
      if (!policyNames.has(policyRef)) {
        results.push(
          diag(
            'AX202',
            'error',
            `Capability '${cap.name}' references undefined policy '${policyRef}'`,
            'capabilities',
            `capabilities.${cap.name}.policies`,
            `Define policy '${policyRef}' or fix the reference`,
          ),
        );
      }
    }
  }

  // AX203: Capability references undefined invariant
  for (const cap of specs.capabilities) {
    for (const invRef of cap.invariants) {
      if (!invariantNames.has(invRef)) {
        results.push(
          diag(
            'AX203',
            'error',
            `Capability '${cap.name}' references undefined invariant '${invRef}'`,
            'capabilities',
            `capabilities.${cap.name}.invariants`,
            `Define invariant '${invRef}' or fix the reference`,
          ),
        );
      }
    }
  }

  // AX204: Policy references undefined capability
  for (const policy of specs.policies) {
    for (const capRef of policy.capabilities) {
      if (!capabilityNames.has(capRef)) {
        results.push(
          diag(
            'AX204',
            'error',
            `Policy '${policy.name}' references undefined capability '${capRef}'`,
            'policies',
            `policies.${policy.name}.capabilities`,
            `Define capability '${capRef}' or fix the reference`,
          ),
        );
      }
    }
  }

  // AX205: Invariant references undefined entity
  for (const inv of specs.invariants) {
    if (!entityNames.has(inv.entity)) {
      results.push(
        diag(
          'AX205',
          'error',
          `Invariant '${inv.name}' references undefined entity '${inv.entity}'`,
          'invariants',
          `invariants.${inv.name}.entity`,
          `Define entity '${inv.entity}' or fix the reference`,
        ),
      );
    }
  }

  // AX206: Flow references undefined capability (trigger)
  for (const flow of specs.flows) {
    if (!capabilityNames.has(flow.trigger)) {
      results.push(
        diag(
          'AX206',
          'error',
          `Flow '${flow.name}' references undefined capability '${flow.trigger}' as trigger`,
          'flows',
          `flows.${flow.name}.trigger`,
          `Define capability '${flow.trigger}' or fix the trigger reference`,
        ),
      );
    }
  }

  // AX207: Flow step references undefined capability/action
  for (const flow of specs.flows) {
    for (const step of flow.steps) {
      if (!capabilityNames.has(step.action)) {
        results.push(
          diag(
            'AX207',
            'error',
            `Flow '${flow.name}' step '${step.name}' references undefined capability/action '${step.action}'`,
            'flows',
            `flows.${flow.name}.steps.${step.name}.action`,
            `Define capability '${step.action}' or fix the step action reference`,
          ),
        );
      }
    }
  }

  // AX208: Module lists undefined entity
  for (const mod of specs.modules) {
    for (const entityRef of mod.entities) {
      if (!entityNames.has(entityRef)) {
        results.push(
          diag(
            'AX208',
            'error',
            `Module '${mod.name}' lists undefined entity '${entityRef}'`,
            'modules',
            `modules.${mod.name}.entities`,
            `Define entity '${entityRef}' or remove it from the module`,
          ),
        );
      }
    }
  }

  // AX209: Module lists undefined capability
  for (const mod of specs.modules) {
    for (const capRef of mod.capabilities) {
      if (!capabilityNames.has(capRef)) {
        results.push(
          diag(
            'AX209',
            'error',
            `Module '${mod.name}' lists undefined capability '${capRef}'`,
            'modules',
            `modules.${mod.name}.capabilities`,
            `Define capability '${capRef}' or remove it from the module`,
          ),
        );
      }
    }
  }

  return results;
}

// ── AX3xx: Boundary Violations ──────────────────────────────────────

/**
 * Detects module boundary violations (AX3xx).
 *
 * Performs the following checks:
 * - AX301: A module lists the same dependency in both `allowedDependencies`
 *   and `forbiddenDependencies`.
 * - AX302: Circular dependencies exist in the module dependency graph.
 * - AX303: A module references an undefined module in its dependency lists.
 * - AX304: A capability uses an entity that belongs to a module outside
 *   the capability's own module boundary and not reachable via allowed dependencies.
 *
 * @param specs - The system specifications to validate.
 * @returns An array of error diagnostics for every boundary violation found.
 */
function checkBoundaries(specs: SystemSpecs): Diagnostic[] {
  const results: Diagnostic[] = [];
  const moduleNames = nameSet(specs.modules);

  // Build a map of module -> allowed/forbidden dependencies
  const moduleMap = new Map<string, ModuleSpec>();
  for (const mod of specs.modules) {
    moduleMap.set(mod.name, mod);
  }

  // Build entity-to-module mapping
  const entityToModules = new Map<string, Set<string>>();
  for (const mod of specs.modules) {
    for (const entity of mod.entities) {
      if (!entityToModules.has(entity)) {
        entityToModules.set(entity, new Set());
      }
      entityToModules.get(entity)!.add(mod.name);
    }
  }

  for (const mod of specs.modules) {
    // AX301: Module depends on forbidden dependency
    for (const dep of mod.allowedDependencies) {
      if (mod.forbiddenDependencies.includes(dep)) {
        // This is handled by AX601, but also flag if a forbidden dep is actually used
      }
    }

    // Check all allowed dependencies for forbidden ones
    for (const dep of mod.allowedDependencies) {
      if (mod.forbiddenDependencies.includes(dep)) {
        results.push(
          diag(
            'AX301',
            'error',
            `Module '${mod.name}' depends on forbidden dependency '${dep}'`,
            'modules',
            `modules.${mod.name}.allowedDependencies`,
            `Remove '${dep}' from allowedDependencies or forbiddenDependencies`,
          ),
        );
      }
    }

    // AX303: Module depends on undefined module
    for (const dep of mod.allowedDependencies) {
      if (!moduleNames.has(dep)) {
        results.push(
          diag(
            'AX303',
            'error',
            `Module '${mod.name}' depends on undefined module '${dep}'`,
            'modules',
            `modules.${mod.name}.allowedDependencies`,
            `Define module '${dep}' or remove the dependency`,
          ),
        );
      }
    }

    for (const dep of mod.forbiddenDependencies) {
      if (!moduleNames.has(dep)) {
        results.push(
          diag(
            'AX303',
            'error',
            `Module '${mod.name}' references undefined module '${dep}' in forbiddenDependencies`,
            'modules',
            `modules.${mod.name}.forbiddenDependencies`,
            `Define module '${dep}' or remove the forbidden dependency reference`,
          ),
        );
      }
    }
  }

  // AX302: Module has circular dependency (DFS-based cycle detection)
  const cycles = detectCycles(specs.modules);
  for (const cycle of cycles) {
    results.push(
      diag(
        'AX302',
        'error',
        `Circular module dependency detected: ${cycle.join(' → ')}`,
        'modules',
        undefined,
        `Break the circular dependency between modules: ${cycle.join(', ')}`,
      ),
    );
  }

  // AX304: Capability uses entity outside module boundary
  for (const cap of specs.capabilities) {
    const capModule = cap.module;
    const mod = moduleMap.get(capModule);
    if (!mod) continue; // module not found — already flagged elsewhere

    for (const entityRef of cap.entities) {
      // Check if entity belongs to the capability's module
      if (mod.entities.includes(entityRef)) continue;

      // Entity is outside this module — check if the entity's owning module is an allowed dependency
      const owningModules = entityToModules.get(entityRef);
      if (!owningModules) continue; // entity not in any module — handled by orphan check

      let allowed = false;
      for (const owningMod of owningModules) {
        if (mod.allowedDependencies.includes(owningMod)) {
          allowed = true;
          break;
        }
      }

      if (!allowed) {
        results.push(
          diag(
            'AX304',
            'error',
            `Capability '${cap.name}' in module '${capModule}' uses entity '${entityRef}' which is outside its module boundary`,
            'capabilities',
            `capabilities.${cap.name}.entities`,
            `Add the entity's module to '${capModule}' allowedDependencies, or move the entity`,
          ),
        );
      }
    }
  }

  return results;
}

/**
 * Detects circular dependencies in the module dependency graph using
 * iterative depth-first search with an explicit recursion stack.
 *
 * Builds a directed graph from each module's `allowedDependencies` and
 * traverses it, recording any back-edges that form cycles.
 *
 * @param modules - The list of module specifications whose dependency
 *   graphs should be checked.
 * @returns An array of cycles, where each cycle is represented as an
 *   ordered array of module names ending with a repetition of the first
 *   name (e.g., `['A', 'B', 'A']`).
 */
function detectCycles(modules: ModuleSpec[]): string[][] {
  const graph = new Map<string, string[]>();
  for (const mod of modules) {
    graph.set(mod.name, [...mod.allowedDependencies]);
  }

  const visited = new Set<string>();
  const onStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    if (onStack.has(node)) {
      // Found a cycle — extract it from the path
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push([...path.slice(cycleStart), node]);
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    onStack.add(node);
    path.push(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (graph.has(neighbor)) {
        dfs(neighbor, path);
      }
    }

    path.pop();
    onStack.delete(node);
  }

  for (const mod of modules) {
    dfs(mod.name, []);
  }

  return cycles;
}

// ── AX4xx: Orphan Detection ─────────────────────────────────────────

/**
 * Detects orphaned specification items that are defined but not meaningfully
 * connected to the rest of the system (AX4xx).
 *
 * Checks for:
 * - AX401: Entities not assigned to any module.
 * - AX402: Capabilities not assigned to any module.
 * - AX403: Policies that do not govern any valid (defined) capability.
 * - AX404: Invariants that reference a non-existent entity.
 *
 * @param specs - The system specifications to validate.
 * @returns An array of warning diagnostics for every orphaned item found.
 */
function checkOrphans(specs: SystemSpecs): Diagnostic[] {
  const results: Diagnostic[] = [];
  const entityNames = nameSet(specs.entities);
  const capabilityNames = nameSet(specs.capabilities);

  // Collect all entities and capabilities assigned to modules
  const assignedEntities = new Set<string>();
  const assignedCapabilities = new Set<string>();
  for (const mod of specs.modules) {
    for (const e of mod.entities) assignedEntities.add(e);
    for (const c of mod.capabilities) assignedCapabilities.add(c);
  }

  // AX401: Entity not assigned to any module
  for (const entity of specs.entities) {
    if (!assignedEntities.has(entity.name)) {
      results.push(
        diag(
          'AX401',
          'warning',
          `Entity '${entity.name}' is not assigned to any module`,
          'entities',
          `entities.${entity.name}`,
          `Add this entity to a module definition`,
        ),
      );
    }
  }

  // AX402: Capability not assigned to any module
  for (const cap of specs.capabilities) {
    if (!assignedCapabilities.has(cap.name)) {
      results.push(
        diag(
          'AX402',
          'warning',
          `Capability '${cap.name}' is not assigned to any module`,
          'capabilities',
          `capabilities.${cap.name}`,
          `Add this capability to a module definition`,
        ),
      );
    }
  }

  // AX403: Policy doesn't govern any valid capability
  for (const policy of specs.policies) {
    const hasValidCap = policy.capabilities.some((c) => capabilityNames.has(c));
    if (!hasValidCap) {
      results.push(
        diag(
          'AX403',
          'warning',
          `Policy '${policy.name}' does not govern any valid capability`,
          'policies',
          `policies.${policy.name}.capabilities`,
          `Add valid capability references to this policy or remove it`,
        ),
      );
    }
  }

  // AX404: Invariant references non-existent entity
  for (const inv of specs.invariants) {
    if (!entityNames.has(inv.entity)) {
      results.push(
        diag(
          'AX404',
          'warning',
          `Invariant '${inv.name}' references non-existent entity '${inv.entity}'`,
          'invariants',
          `invariants.${inv.name}.entity`,
          `Define entity '${inv.entity}' or update the invariant`,
        ),
      );
    }
  }

  return results;
}

// ── AX5xx: Safety ───────────────────────────────────────────────────

/**
 * Validates consistency between safe-edit-zone declarations and the generated
 * manifest (AX5xx). If no manifest is provided, safety checks are skipped.
 *
 * Checks for:
 * - AX501: A file declared as `generated` in safe-edit-zones is missing from
 *   the manifest.
 * - AX502: The zone type declared in safe-edit-zones does not match the zone
 *   type recorded in the manifest for the same path.
 *
 * @param specs - The system specifications containing `safeEditZones`.
 * @param manifest - The optional generated manifest to validate against.
 * @returns An array of warning diagnostics for any safety mismatches found,
 *   or an empty array if the manifest is not provided.
 */
function checkSafety(
  specs: SystemSpecs,
  manifest?: GeneratedManifest,
): Diagnostic[] {
  const results: Diagnostic[] = [];

  if (!manifest) return results;

  const manifestPathMap = new Map<string, string>();
  for (const entry of manifest.files) {
    manifestPathMap.set(entry.path, entry.zone);
  }

  // AX501: Generated file missing from manifest
  for (const zone of specs.safeEditZones) {
    if (zone.zone === 'generated' && !manifestPathMap.has(zone.path)) {
      results.push(
        diag(
          'AX501',
          'warning',
          `Generated file '${zone.path}' is declared in safe-edit-zones but missing from manifest`,
          'safe-edit-zones',
          `safeEditZones.${zone.path}`,
          `Regenerate the file or update the safe-edit-zone declaration`,
        ),
      );
    }
  }

  // AX502: Inconsistent zone declaration
  for (const zone of specs.safeEditZones) {
    const manifestZone = manifestPathMap.get(zone.path);
    if (manifestZone !== undefined && manifestZone !== zone.zone) {
      results.push(
        diag(
          'AX502',
          'warning',
          `Zone mismatch for '${zone.path}': safe-edit-zone declares '${zone.zone}' but manifest declares '${manifestZone}'`,
          'safe-edit-zones',
          `safeEditZones.${zone.path}`,
          `Align the zone declaration between safe-edit-zones and the generated manifest`,
        ),
      );
    }
  }

  return results;
}

// ── AX6xx: Consistency ──────────────────────────────────────────────

/**
 * Checks for internal consistency issues within module dependency declarations
 * (AX6xx).
 *
 * Checks for:
 * - AX601: A module lists the same dependency in both `allowedDependencies`
 *   and `forbiddenDependencies`.
 * - AX602: A module lists itself in its own `allowedDependencies` or
 *   `forbiddenDependencies` (self-reference).
 *
 * @param specs - The system specifications to validate.
 * @returns An array of error diagnostics for every consistency violation found.
 */
function checkConsistency(specs: SystemSpecs): Diagnostic[] {
  const results: Diagnostic[] = [];

  for (const mod of specs.modules) {
    // AX601: Module forbidden and allowed deps overlap
    const overlap = mod.allowedDependencies.filter((d) =>
      mod.forbiddenDependencies.includes(d),
    );
    for (const dep of overlap) {
      results.push(
        diag(
          'AX601',
          'error',
          `Module '${mod.name}' lists '${dep}' in both allowedDependencies and forbiddenDependencies`,
          'modules',
          `modules.${mod.name}`,
          `Remove '${dep}' from either allowedDependencies or forbiddenDependencies`,
        ),
      );
    }

    // AX602: Self-referencing module dependency
    if (mod.allowedDependencies.includes(mod.name)) {
      results.push(
        diag(
          'AX602',
          'error',
          `Module '${mod.name}' lists itself as an allowed dependency`,
          'modules',
          `modules.${mod.name}.allowedDependencies`,
          `Remove self-reference from allowedDependencies`,
        ),
      );
    }
    if (mod.forbiddenDependencies.includes(mod.name)) {
      results.push(
        diag(
          'AX602',
          'error',
          `Module '${mod.name}' lists itself as a forbidden dependency`,
          'modules',
          `modules.${mod.name}.forbiddenDependencies`,
          `Remove self-reference from forbiddenDependencies`,
        ),
      );
    }
  }

  return results;
}

// ── Main Engine ─────────────────────────────────────────────────────

/**
 * Runs all diagnostic checks against the given system specifications and
 * returns a consolidated report.
 *
 * The following check categories are executed in order:
 * - **AX1xx** - Duplicate name detection across entities, capabilities, policies, invariants, modules, and flows.
 * - **AX2xx** - Reference resolution ensuring all cross-references (e.g., capability to entity) resolve to defined items.
 * - **AX3xx** - Module boundary violations including circular dependencies, forbidden dependency usage, and cross-boundary entity access.
 * - **AX4xx** - Orphan detection for entities and capabilities not assigned to modules, and policies without valid capability targets.
 * - **AX5xx** - Safety checks validating consistency between safe-edit-zone declarations and the generated manifest.
 * - **AX6xx** - Consistency checks for conflicting or self-referencing module dependency declarations.
 *
 * @param specs - The full system specification to validate.
 * @param manifest - An optional generated manifest used for safety checks (AX5xx). If omitted, safety checks are skipped.
 * @returns A {@link DiagnosticsReport} containing all diagnostics, counts by severity, and a timestamp.
 *
 * @example
 * ```ts
 * const report = runDiagnostics(specs, manifest);
 * if (report.totalErrors > 0) {
 *   console.error(`Found ${report.totalErrors} error(s)`);
 * }
 * ```
 */
export function runDiagnostics(
  specs: SystemSpecs,
  manifest?: GeneratedManifest,
): DiagnosticsReport {
  const diagnostics: Diagnostic[] = [
    ...checkDuplicates(specs),
    ...checkReferences(specs),
    ...checkBoundaries(specs),
    ...checkOrphans(specs),
    ...checkSafety(specs, manifest),
    ...checkConsistency(specs),
  ];

  const totalErrors = diagnostics.filter((d) => d.severity === 'error').length;
  const totalWarnings = diagnostics.filter((d) => d.severity === 'warning').length;
  const totalInfo = diagnostics.filter((d) => d.severity === 'info').length;

  return {
    timestamp: new Date().toISOString(),
    totalErrors,
    totalWarnings,
    totalInfo,
    diagnostics,
  };
}
