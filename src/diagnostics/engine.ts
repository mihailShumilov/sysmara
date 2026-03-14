import type {
  SystemSpecs,
  GeneratedManifest,
  Diagnostic,
  DiagnosticsReport,
  DiagnosticSeverity,
  ModuleSpec,
} from '../types/index.js';

// ── Helpers ──────────────────────────────────────────────────────────

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

function nameSet(items: { name: string }[]): Set<string> {
  return new Set(items.map((i) => i.name));
}

// ── AX1xx: Duplicate Names ──────────────────────────────────────────

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
